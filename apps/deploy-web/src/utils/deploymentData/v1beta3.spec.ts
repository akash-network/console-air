import { DeploymentReclamation } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { HttpClient } from "@akashnetwork/http-sdk";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { NewDeploymentData, replaceSdlDenom } from "./v1beta3";

describe(replaceSdlDenom.name, () => {
  it("replaces denom in a single placement pricing entry", () => {
    const { sdl } = setup({ placements: { dcloud: { web: "uakt" } } });

    const result = replaceSdlDenom(sdl, "uact");

    expect(parsePricing(result, "dcloud", "web").denom).toBe("uact");
  });

  it("replaces denom across multiple services in the same placement", () => {
    const { sdl } = setup({ placements: { dcloud: { web: "uakt", api: "uakt" } } });

    const result = replaceSdlDenom(sdl, "uact");

    expect(parsePricing(result, "dcloud", "web").denom).toBe("uact");
    expect(parsePricing(result, "dcloud", "api").denom).toBe("uact");
  });

  it("replaces denom across multiple placements", () => {
    const ibcDenom = "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1";
    const { sdl } = setup({ placements: { us: { web: "uakt" }, eu: { web: "uakt" } } });

    const result = replaceSdlDenom(sdl, ibcDenom);

    expect(parsePricing(result, "us", "web").denom).toBe(ibcDenom);
    expect(parsePricing(result, "eu", "web").denom).toBe(ibcDenom);
  });

  it("preserves non-pricing SDL fields", () => {
    const { sdl } = setup({ placements: { dcloud: { web: "uakt" } } });

    const result = replaceSdlDenom(sdl, "uact");
    const parsed = yaml.load(result) as ParsedSdl;

    expect(parsed.version).toBe("2.0");
    expect(parsed.services.web.image).toBe("nginx");
    expect(parsePricing(result, "dcloud", "web").amount).toBe(1000);
    expect(parsed.deployment.web.dcloud.profile).toBe("web");
  });

  it("handles SDL with empty placement gracefully", () => {
    const { sdl } = setup({ placements: {} });

    const result = replaceSdlDenom(sdl, "uact");
    const parsed = yaml.load(result) as ParsedSdl;

    expect(parsed.profiles.placement).toEqual({});
  });

  it("returns valid YAML prefixed with document separator", () => {
    const { sdl } = setup({ placements: { dcloud: { web: "uakt" } } });

    const result = replaceSdlDenom(sdl, "uact");

    expect(result).toMatch(/^---\n/);
    expect(() => yaml.load(result)).not.toThrow();
  });

  interface ParsedSdl {
    version: string;
    services: Record<string, { image: string }>;
    profiles: {
      compute: Record<string, unknown>;
      placement: Record<string, { pricing: Record<string, { denom: string; amount: number }> }>;
    };
    deployment: Record<string, Record<string, { profile: string; count: number }>>;
  }

  function parsePricing(resultYaml: string, placement: string, service: string) {
    const parsed = yaml.load(resultYaml) as ParsedSdl;
    return parsed.profiles.placement[placement].pricing[service];
  }

  function setup(input: { placements: Record<string, Record<string, string>> }) {
    const placements: Record<string, { pricing: Record<string, { denom: string; amount: number }> }> = {};
    const services: Record<string, { image: string }> = {};
    const compute: Record<string, { resources: Record<string, never> }> = {};
    const deployment: Record<string, Record<string, { profile: string; count: number }>> = {};

    for (const [placementName, pricing] of Object.entries(input.placements)) {
      placements[placementName] = { pricing: {} };
      for (const [serviceName, denom] of Object.entries(pricing)) {
        placements[placementName].pricing[serviceName] = { denom, amount: 1000 };
        services[serviceName] = services[serviceName] || { image: "nginx" };
        compute[serviceName] = compute[serviceName] || { resources: {} };
        deployment[serviceName] = deployment[serviceName] || {};
        deployment[serviceName][placementName] = { profile: serviceName, count: 1 };
      }
    }

    const sdl = yaml.dump({
      version: "2.0",
      services,
      profiles: { compute, placement: placements },
      deployment
    });

    return { sdl };
  }
});

describe(NewDeploymentData.name, () => {
  it("forwards the reclamation block when the SDL declares one", async () => {
    const { chainApiHttpClient, sdl } = setup({ version: "2.1", reclamation: { min_window: "24h" } });

    const result = await NewDeploymentData(chainApiHttpClient, sdl, "12345", "akash1abc", 5);

    expect(result.reclamation).toEqual(DeploymentReclamation.fromPartial({ minWindow: { seconds: 86400 } }));
  });

  it("omits reclamation for an SDL without a reclamation block", async () => {
    const { chainApiHttpClient, sdl } = setup({ version: "2.0" });

    const result = await NewDeploymentData(chainApiHttpClient, sdl, "12345", "akash1abc", 5);

    expect(result.reclamation).toBeUndefined();
  });

  function setup(input: { version: "2.0" | "2.1"; reclamation?: { min_window: string } }) {
    const chainApiHttpClient = mock<HttpClient>();
    const sdl = yaml.dump({
      version: input.version,
      services: { web: { image: "nginx", expose: [{ port: 80, as: 80, to: [{ global: true }] }] } },
      profiles: {
        compute: { web: { resources: { cpu: { units: 0.5 }, memory: { size: "512Mi" }, storage: { size: "1Gi" } } } },
        placement: { dcloud: { pricing: { web: { denom: "uakt", amount: 1000 } } } }
      },
      deployment: { web: { dcloud: { profile: "web", count: 1 } } },
      ...(input.reclamation ? { reclamation: input.reclamation } : {})
    });
    return { chainApiHttpClient, sdl };
  }
});
