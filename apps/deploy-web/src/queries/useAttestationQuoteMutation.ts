import { useMutation } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useProviderCredentials } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import type { ProviderIdentity } from "@src/services/provider-proxy/provider-proxy.service";
import type { AttestationEvidence } from "@src/utils/confidentialCompute";

export const DEPENDENCIES = {
  useServices,
  useProviderCredentials
};

/**
 * Fetches the lease's attestation evidence on demand. Modeled as a mutation rather than a query because a
 * fresh nonce is generated per request (CON-540): the evidence must be re-fetched, never served from cache.
 *
 * Authenticated with the lease owner's provider credentials (mTLS in this self-custody fork; the JWT
 * fallback is used only when the chain is unreachable) — the same credential path the status/logs/shell/
 * manifest endpoints use, so no managed-wallet provider token is required.
 */
export function useAttestationQuoteMutation(
  params: {
    provider: ProviderIdentity | undefined | null;
    dseq: string;
    gseq: number;
    oseq: number;
  },
  dependencies: typeof DEPENDENCIES = DEPENDENCIES
) {
  const { providerProxy } = dependencies.useServices();
  const providerCredentials = dependencies.useProviderCredentials();

  return useMutation<AttestationEvidence, Error>({
    mutationFn: () => {
      const provider = params.provider;
      if (!provider) throw new Error("Provider is not available for this lease.");
      return providerProxy.fetchAttestationQuote({
        provider,
        dseq: params.dseq,
        gseq: params.gseq,
        oseq: params.oseq,
        credentials: providerCredentials.details
      });
    }
  });
}
