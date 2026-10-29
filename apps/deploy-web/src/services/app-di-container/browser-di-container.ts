import { browserEnvConfig } from "@src/config/browser-env.config";
import { ApiUrlService } from "@src/services/api-url/api-url.service";
import * as walletUtils from "@src/utils/walletUtils";
import { createChildContainer } from "../container/createContainer";
import { DeploymentStorageService } from "../deployment-storage/deployment-storage.service";
import { createAppRootContainer } from "./app-di-container";

// Console API (/v1/*) requests are proxied through Next's /api/proxy/{network}
// route so the browser only ever talks to its own origin. The proxy forwards
// server-side to the per-network upstream derived from NEXT_PUBLIC_API_BASE_URL
// (mainnet → console-api.akash.network, sandbox → console-api-sandbox-staging.akash.network).
const rootContainer = createAppRootContainer({
  runtimeEnv: "browser",
  // Used as a fixed mainnet base for http-sdk services constructed at root-container
  // time. None of those services are wired up in Console Air today, so a stale
  // mainnet value here is harmless; the network-aware path is the consoleApiHttpClient
  // interceptor below.
  BASE_API_MAINNET_URL: "/api/proxy/mainnet",
  apiUrlService: () => new ApiUrlService(browserEnvConfig)
});

export const services = createChildContainer(rootContainer, {
  consoleApiHttpClient: () =>
    services.applyAxiosInterceptors(services.createAxios(), {
      request: [
        config => {
          config.baseURL = `/api/proxy/${services.networkStore.selectedNetworkId}`;
          return config;
        }
      ]
    }),
  publicConsoleApiHttpClient: () => services.applyAxiosInterceptors(services.createAxios()),
  fallbackChainApiHttpClient: () =>
    services.applyAxiosInterceptors(services.createAxios(), {
      request: [
        config => {
          config.baseURL = services.apiUrlService.getBaseApiUrlFor(services.networkStore.selectedNetworkId);
          return config;
        }
      ]
    }),
  storedWalletsService: () => walletUtils,
  deploymentLocalStorage: () => new DeploymentStorageService(localStorage, services.networkStore),
  windowLocation: () => window.location,
  windowHistory: () => window.history
});
