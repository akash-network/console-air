import { useMutation } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import type { AttestationEvidence } from "@src/utils/confidentialCompute";

export const DEPENDENCIES = {
  useServices
};

/** Same-origin Next.js API route that self-hosts the vendor verification (CON-552). */
export const ATTESTATION_VALIDATE_PATH = "/api/confidential-compute/attestation/validate";

export type AttestationReportStatus = "valid" | "invalid" | "unverifiable";

/** Per-report authenticity verdict returned by the local validation route (mirrors the server attestation.schema). */
export interface AttestationReportVerdict {
  kind: "cpu" | "gpu";
  /** Present for GPU reports; identifies the device. */
  device_index?: number;
  vendor: string;
  status: AttestationReportStatus;
  detail: string;
}

export interface AttestationValidationResult {
  overall: AttestationReportStatus;
  nonce: string;
  reports: AttestationReportVerdict[];
}

/**
 * Validates downloaded attestation evidence against the hardware vendors (CON-552). Modeled as a mutation
 * because validation is an explicit, on-demand action that makes outbound vendor calls — not a cacheable read.
 *
 * Unlike upstream (which posts to the hosted Console API), this self-custody fork hosts the verifier in a local
 * Next.js API route, so the evidence is posted same-origin via `publicConsoleApiHttpClient` and never leaves the
 * deployment's own server. The body uses the vendor (snake_case) field names so it matches the server schema.
 */
export function useAttestationValidationMutation(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const { publicConsoleApiHttpClient } = dependencies.useServices();

  return useMutation<AttestationValidationResult, Error, { evidence: AttestationEvidence }>({
    mutationFn: async ({ evidence }) => {
      const response = await publicConsoleApiHttpClient.post<AttestationValidationResult>(ATTESTATION_VALIDATE_PATH, {
        nonce: evidence.nonce,
        report: evidence.quote.report,
        tee_platform: evidence.quote.tee_platform,
        cert_chain: evidence.quote.cert_chain ?? "",
        auxblob: evidence.quote.auxblob ?? "",
        gpu_reports: evidence.quote.gpu_reports ?? []
      });
      return response.data;
    }
  });
}
