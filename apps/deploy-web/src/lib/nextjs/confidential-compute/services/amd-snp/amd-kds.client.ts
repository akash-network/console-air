import type { HttpClient } from "@akashnetwork/http-sdk";
import { LoggerService } from "@akashnetwork/logging";
import { isAxiosError } from "axios";

import type { ParsedSnpReport } from "./snp-report.parser";

/** ARK (root) and ASK (intermediate) certificates for an AMD product, PEM-encoded. */
export interface AmdCaChain {
  ask: string;
  ark: string;
}

const CA_CHAIN_TTL_MS = 24 * 60 * 60 * 1000;
// CRLs rotate more often than the CA chain; the verifier additionally enforces the CRL's own nextUpdate.
const CRL_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Thin client over the AMD Key Distribution Service (https://kdsintf.amd.com). It fetches the per-chip VCEK
 * (DER) and the per-product ARK/ASK chain (PEM). A 404 (e.g. wrong product guess) resolves to `null` so the
 * caller can probe the next candidate product; transport errors propagate so the verifier reports `unverifiable`.
 *
 * Ported from apps/api: tsyringe DI replaced with constructor injection, and the api app's `@Memoize`
 * decorator on {@link getCaChain} replaced with a small in-instance TTL cache (the chain rotates rarely).
 */
export class AmdKdsClient {
  readonly #caChainCache = new Map<string, { value: AmdCaChain | null; expiresAt: number }>();
  readonly #crlCache = new Map<string, { value: Buffer | null; expiresAt: number }>();

  constructor(
    private readonly httpClient: HttpClient,
    private readonly logger: LoggerService = new LoggerService({ name: "AmdKdsClient" })
  ) {}

  /** Fetches the VCEK for a chip at a specific reported TCB. Returns `null` when KDS has no such product/chip (404). */
  async getVcek(product: string, report: Pick<ParsedSnpReport, "chipId" | "reportedTcb">): Promise<Buffer | null> {
    const { bootloader, tee, snp, microcode } = report.reportedTcb;
    const chipId = report.chipId.toString("hex");
    const path = `/vcek/v1/${product}/${chipId}?blSPL=${bootloader}&teeSPL=${tee}&snpSPL=${snp}&ucodeSPL=${microcode}`;

    try {
      const response = await this.httpClient.get<ArrayBuffer>(path, { responseType: "arraybuffer" });
      return Buffer.from(response.data);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) return null;
      this.logger.error({ event: "AMD_KDS_VCEK_FETCH_FAILED", product, error });
      throw error;
    }
  }

  /** Fetches the ARK+ASK chain for a product (cached — it rotates rarely). Returns `null` when the product is unknown (404). */
  async getCaChain(product: string): Promise<AmdCaChain | null> {
    const cached = this.#caChainCache.get(product);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    try {
      const response = await this.httpClient.get<string>(`/vcek/v1/${product}/cert_chain`, { responseType: "text" });
      const certs = splitPemChain(response.data);
      // KDS returns the chain as ASK then ARK.
      if (certs.length < 2) {
        this.logger.error({ event: "AMD_KDS_CHAIN_MALFORMED", product, certCount: certs.length });
        return this.#cacheCaChain(product, null);
      }
      return this.#cacheCaChain(product, { ask: certs[0], ark: certs[1] });
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) return this.#cacheCaChain(product, null);
      this.logger.error({ event: "AMD_KDS_CHAIN_FETCH_FAILED", product, error });
      throw error;
    }
  }

  /**
   * Fetches the DER-encoded CRL for a product (cached). Returns `null` when the product has no CRL
   * (404); transport errors propagate so the verifier treats revocation status as unknown.
   */
  async getCrl(product: string): Promise<Buffer | null> {
    const cached = this.#crlCache.get(product);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    try {
      const response = await this.httpClient.get<ArrayBuffer>(`/vcek/v1/${product}/crl`, { responseType: "arraybuffer" });
      return this.#cacheCrl(product, Buffer.from(response.data));
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) return this.#cacheCrl(product, null);
      this.logger.error({ event: "AMD_KDS_CRL_FETCH_FAILED", product, error });
      throw error;
    }
  }

  #cacheCaChain(product: string, value: AmdCaChain | null): AmdCaChain | null {
    this.#caChainCache.set(product, { value, expiresAt: Date.now() + CA_CHAIN_TTL_MS });
    return value;
  }

  #cacheCrl(product: string, value: Buffer | null): Buffer | null {
    this.#crlCache.set(product, { value, expiresAt: Date.now() + CRL_TTL_MS });
    return value;
  }
}

/** Splits a concatenated PEM blob into individual `-----BEGIN CERTIFICATE-----...` strings. */
export function splitPemChain(pem: string): string[] {
  return pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
}
