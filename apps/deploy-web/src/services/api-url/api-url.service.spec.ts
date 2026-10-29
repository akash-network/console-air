import { describe, expect, it } from "vitest";

import { browserEnvSchema } from "@src/config/env-config.schema";
import { ApiUrlService } from "./api-url.service";

describe(ApiUrlService.name, () => {
  describe("getProviderProxyUrlFor", () => {
    it("returns the staging sandbox provider proxy for sandbox by default", () => {
      const { service } = setup();

      expect(service.getProviderProxyUrlFor("sandbox")).toBe("https://console-beta.akash.network/provider-proxy-sandbox");
    });

    it("substitutes the network into the provider proxy template for mainnet", () => {
      const { service } = setup();

      expect(service.getProviderProxyUrlFor("mainnet")).toBe("https://console.akash.network/provider-proxy-mainnet");
    });

    it("substitutes the network into the provider proxy template for testnet", () => {
      const { service } = setup();

      expect(service.getProviderProxyUrlFor("testnet")).toBe("https://console.akash.network/provider-proxy-testnet");
    });

    it("returns the configured sandbox provider proxy instead of the template", () => {
      const { service } = setup({
        NEXT_PUBLIC_PROVIDER_PROXY_URL: "https://proxy.example.com/%{NETWORK}",
        NEXT_PUBLIC_PROVIDER_PROXY_URL_SANDBOX: "https://sandbox-proxy.example.com"
      });

      expect(service.getProviderProxyUrlFor("sandbox")).toBe("https://sandbox-proxy.example.com");
      expect(service.getProviderProxyUrlFor("mainnet")).toBe("https://proxy.example.com/mainnet");
    });
  });

  describe("getConsoleApiUrlFor", () => {
    it("returns the staging sandbox console API for sandbox by default", () => {
      const { service } = setup();

      expect(service.getConsoleApiUrlFor("sandbox")).toBe("https://console-api-sandbox-staging.akash.network");
    });

    it("returns the mainnet console API by default", () => {
      const { service } = setup();

      expect(service.getConsoleApiUrlFor("mainnet")).toBe("https://console-api.akash.network");
    });
  });

  describe("getBaseApiUrlFor", () => {
    it("returns the staging sandbox chain API for sandbox by default", () => {
      const { service } = setup();

      expect(service.getBaseApiUrlFor("sandbox")).toBe("https://console-beta.akash.network/api-sandbox");
    });

    it("returns the mainnet chain API by default", () => {
      const { service } = setup();

      expect(service.getBaseApiUrlFor("mainnet")).toBe("https://console.akash.network/api-mainnet");
    });
  });

  function setup(env: Record<string, string> = {}) {
    const service = new ApiUrlService(browserEnvSchema.parse(env));
    return { service };
  }
});
