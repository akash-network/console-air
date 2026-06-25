"use client";
import { useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { ShieldCheck } from "lucide-react";

import type { UseProviderCredentialsResult } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import type { ProviderIdentity } from "@src/services/provider-proxy/provider-proxy.service";
import type { LeaseDto } from "@src/types/deployment";
import { getGroupTeeType } from "@src/utils/confidentialCompute";
import { isLeaseLive } from "@src/utils/reclamationUtils";
import { AttestationEvidenceModal } from "./AttestationEvidenceModal";

export const DEPENDENCIES = {
  AttestationEvidenceModal
};

type Props = {
  lease: LeaseDto;
  provider: ProviderIdentity | undefined | null;
  providerCredentials: UseProviderCredentialsResult["details"];
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Surfaces the attestation-evidence download for a running Confidential Compute lease. Renders nothing
 * unless the lease is live, a provider is resolved, the lease's on-chain group declares a TEE type, and
 * usable provider credentials exist — so the option never appears for non-Confidential-Compute deployments
 * (CON-540), and never fires an uncredentialed provider request (the deployment view shows a
 * CreateCredentialsButton as the call-to-action when no usable credential exists).
 */
export function DownloadAttestationEvidence({ lease, provider, providerCredentials, dependencies: d = DEPENDENCIES }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isLeaseLive(lease) || !provider || !getGroupTeeType(lease.group) || !providerCredentials.usable) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <ShieldCheck className="mr-2 h-4 w-4" />
        Attestation evidence
      </Button>

      {isOpen && <d.AttestationEvidenceModal provider={provider} lease={lease} onClose={() => setIsOpen(false)} />}
    </>
  );
}
