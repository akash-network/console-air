import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UseProviderCredentialsResult } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import type { ProviderProxyService } from "@src/services/provider-proxy/provider-proxy.service";
import type { AttestationQuote } from "@src/utils/confidentialCompute";
import { DEPENDENCIES, useAttestationQuoteMutation } from "./useAttestationQuoteMutation";

import { setupQuery } from "@tests/unit/query-client";

const MTLS_CREDENTIALS: UseProviderCredentialsResult["details"] = {
  type: "mtls",
  value: { cert: "certPem", key: "keyPem" },
  isExpired: false,
  usable: true
};

describe(useAttestationQuoteMutation.name, () => {
  it("fetches the attestation evidence for the lease and exposes the data", async () => {
    const { result, providerProxy, evidence } = setup({ nonce: "nonce-base64", quote: { report: "cpu-report", tee_platform: "snp" } });

    result.current.mutate();

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(evidence);
    expect(providerProxy.fetchAttestationQuote).toHaveBeenCalledWith(
      expect.objectContaining({ provider: { owner: "akash1provider", hostUri: "https://provider.test" }, dseq: "123", gseq: 1, oseq: 2 })
    );
  });

  it("authorizes the provider call with the lease owner's provider credentials", async () => {
    const { result, providerProxy } = setup({ quote: { report: "cpu-report", tee_platform: "snp" }, credentials: MTLS_CREDENTIALS });

    result.current.mutate();

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(providerProxy.fetchAttestationQuote).toHaveBeenCalledWith(expect.objectContaining({ credentials: MTLS_CREDENTIALS }));
  });

  it("surfaces the error when the provider call fails", async () => {
    const { result } = setup({ rejection: new Error("provider unreachable") });

    result.current.mutate();

    await vi.waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("provider unreachable");
  });

  function setup(input: { quote?: AttestationQuote; nonce?: string; rejection?: Error; credentials?: UseProviderCredentialsResult["details"] }) {
    const evidence = input.quote ? { nonce: input.nonce ?? "nonce-base64", quote: input.quote } : undefined;
    const providerProxy = mock<ProviderProxyService>({
      fetchAttestationQuote: vi.fn(input.rejection ? () => Promise.reject(input.rejection) : () => Promise.resolve(evidence!))
    });
    const useProviderCredentials = () => ({ details: input.credentials ?? MTLS_CREDENTIALS, generate: vi.fn(async () => {}) });

    const { result } = setupQuery(
      () =>
        useAttestationQuoteMutation(
          { provider: { owner: "akash1provider", hostUri: "https://provider.test" }, dseq: "123", gseq: 1, oseq: 2 },
          { ...DEPENDENCIES, useProviderCredentials }
        ),
      { services: { providerProxy: () => providerProxy } }
    );

    return { result, providerProxy, evidence };
  }
});
