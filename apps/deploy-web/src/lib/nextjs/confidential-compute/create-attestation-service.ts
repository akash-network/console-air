import { createHttpClient } from "@akashnetwork/http-sdk";
import { LoggerService } from "@akashnetwork/logging";

import { envSchema } from "./config/env.config";
import { AmdKdsClient } from "./services/amd-snp/amd-kds.client";
import { AmdSnpService } from "./services/amd-snp/amd-snp.service";
import { AttestationService } from "./services/attestation.service";
import { IntelTdxService } from "./services/intel-tdx/intel-tdx.service";
import { NvidiaGpuService } from "./services/nvidia-gpu/nvidia-gpu.service";

/**
 * Composes the {@link AttestationService} from config + the three vendor HTTP clients. Replaces the api app's
 * tsyringe providers (config.provider / vendor-clients.provider) with plain construction, since this fork hosts
 * the verifier in a Next.js API route rather than the api app's DI container. Cached per process — the config
 * and clients are stateless and the AMD CA chain cache should be shared across requests.
 */
let cached: AttestationService | undefined;

export function createAttestationService(): AttestationService {
  if (cached) return cached;

  const config = envSchema.parse(process.env);
  const logger = new LoggerService({ name: "confidential-compute" });

  const amdKdsClient = createHttpClient({ baseURL: config.AMD_KDS_BASE_URL, adapter: "http" });
  const nvidiaNrasClient = createHttpClient({ baseURL: config.NVIDIA_NRAS_BASE_URL, adapter: "http" });
  const intelItaClient = createHttpClient({ baseURL: config.INTEL_ITA_BASE_URL, adapter: "http" });

  const amdSnpService = new AmdSnpService(new AmdKdsClient(amdKdsClient, logger), config, logger);
  const nvidiaGpuService = new NvidiaGpuService(nvidiaNrasClient, config, logger);
  const intelTdxService = new IntelTdxService(intelItaClient, config, logger);

  cached = new AttestationService(amdSnpService, intelTdxService, nvidiaGpuService, logger);
  return cached;
}
