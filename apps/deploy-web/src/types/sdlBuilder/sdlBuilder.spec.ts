import { describe, expect, it } from "vitest";

import { ServiceSchema } from "./sdlBuilder";

describe("ServiceSchema", () => {
  it("validates a minimal valid service", () => {
    const result = ServiceSchema.safeParse(buildService());

    expect(result.success).toBe(true);
  });

  describe("params.tee GPU coupling", () => {
    it("rejects a cpu-gpu enclave on a service without a GPU profile", () => {
      const result = ServiceSchema.safeParse(buildService({ profile: { hasGpu: false }, params: { tee: "cpu-gpu" } }));

      expect(result.success).toBe(false);
      const teeIssue = !result.success && result.error.issues.find(issue => issue.path.join(".") === "params.tee");
      expect(teeIssue).toBeTruthy();
    });

    it("accepts a cpu-gpu enclave when the service has a GPU profile", () => {
      const result = ServiceSchema.safeParse(buildService({ profile: { hasGpu: true, gpu: 1, gpuModels: [{ vendor: "nvidia" }] }, params: { tee: "cpu-gpu" } }));

      expect(result.success).toBe(true);
    });

    it("accepts a cpu enclave on a service without a GPU profile", () => {
      const result = ServiceSchema.safeParse(buildService({ profile: { hasGpu: false }, params: { tee: "cpu" } }));

      expect(result.success).toBe(true);
    });

    it("accepts a service with no tee param regardless of GPU profile", () => {
      const result = ServiceSchema.safeParse(buildService({ profile: { hasGpu: false } }));

      expect(result.success).toBe(true);
    });
  });

  function buildService(overrides?: { profile?: Record<string, unknown>; params?: Record<string, unknown> }) {
    return {
      title: "web",
      image: "nginx:latest",
      profile: {
        cpu: 0.1,
        ram: 256,
        ramUnit: "Mi",
        storage: [{ size: 512, unit: "Mi" }],
        ...overrides?.profile
      },
      expose: [{ port: 80, as: 80, global: true }],
      placement: {
        name: "dcloud",
        pricing: { amount: 1000, denom: "uakt" }
      },
      count: 1,
      ...(overrides?.params ? { params: overrides.params } : {})
    };
  }
});
