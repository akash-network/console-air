import { z } from "zod";

/**
 * Request/response contract for confidential-compute attestation verification (CON-552, AEP-83 §5).
 *
 * The client posts the hardware-signed evidence it downloaded from the provider gateway (the CPU `report`
 * plus one `gpu_reports[]` entry per GPU) together with the per-request `nonce` it challenged the hardware
 * with. The server returns an authenticity verdict per report — it does NOT check workload measurement.
 *
 * Field names mirror the provider gateway / chain-sdk `AttestationQuoteResponse` wire shape (snake_case,
 * `device_index`) so the downloaded bundle can be posted back verbatim.
 *
 * Ported from apps/api with `@hono/zod-openapi` swapped for plain `zod` (this fork has no OpenAPI registry).
 */

const Base64String = z.string();

export const TeePlatformSchema = z.enum(["snp", "tdx", "snp-gpu", "tdx-gpu"]);
export type TeePlatform = z.infer<typeof TeePlatformSchema>;

const GpuReportSchema = z.object({
  device_index: z.number().int().nonnegative(),
  report: Base64String
});

export const VerifyAttestationRequestSchema = z.object({
  nonce: z.string().min(1),
  report: Base64String,
  tee_platform: TeePlatformSchema,
  // Lenient (no decode/length refinement) on purpose: a malformed blob must surface as a per-report `invalid`
  // verdict, never a 400 that hides the other reports' verdicts.
  cert_chain: Base64String.optional().default(""),
  auxblob: Base64String.optional().default(""),
  gpu_reports: z.array(GpuReportSchema).optional().default([])
});
export type VerifyAttestationRequest = z.infer<typeof VerifyAttestationRequestSchema>;

/**
 * valid = chained to the vendor root, signature/EAT verified, and bound to the request nonce;
 * invalid = a check ran and failed (bad signature, untrusted chain, nonce mismatch);
 * unverifiable = the check could not be completed (vendor service unreachable, not configured, missing material).
 */
export const ReportStatusSchema = z.enum(["valid", "invalid", "unverifiable"]);
export type ReportStatus = z.infer<typeof ReportStatusSchema>;

/** Granular sub-results behind the verdict; fields are omitted when not evaluated. */
const VerdictChecksSchema = z.object({
  certChainValid: z.boolean().optional(),
  signatureValid: z.boolean().optional(),
  nonceMatch: z.boolean().optional(),
  notRevoked: z.boolean().optional()
});

const CpuReportVerdictSchema = z.object({
  kind: z.literal("cpu"),
  vendor: z.enum(["amd-sev-snp", "intel-tdx"]),
  status: ReportStatusSchema,
  detail: z.string(),
  checks: VerdictChecksSchema.optional()
});

const GpuReportVerdictSchema = z.object({
  kind: z.literal("gpu"),
  device_index: z.number().int().nonnegative(),
  vendor: z.literal("nvidia"),
  status: ReportStatusSchema,
  detail: z.string(),
  checks: VerdictChecksSchema.optional()
});

export const ReportVerdictSchema = z.discriminatedUnion("kind", [CpuReportVerdictSchema, GpuReportVerdictSchema]);
export type ReportVerdict = z.infer<typeof ReportVerdictSchema>;
export type CpuReportVerdict = z.infer<typeof CpuReportVerdictSchema>;
export type GpuReportVerdict = z.infer<typeof GpuReportVerdictSchema>;

export const VerifyAttestationResponseSchema = z.object({
  overall: ReportStatusSchema,
  nonce: z.string(),
  reports: z.array(ReportVerdictSchema)
});
export type VerifyAttestationResponse = z.infer<typeof VerifyAttestationResponseSchema>;
