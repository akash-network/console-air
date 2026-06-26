export { attestationValidateHandler as default } from "@src/lib/nextjs/confidential-compute/validate.handler";

// Cap the request body: the evidence bundle (CPU report + per-GPU reports + cert material) is small.
export const config = {
  api: {
    bodyParser: { sizeLimit: "256kb" }
  }
};
