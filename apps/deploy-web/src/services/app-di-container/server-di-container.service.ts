import { serverEnvConfig } from "@src/config/server-env.config";
import { ApiUrlService } from "../api-url/api-url.service";
import { clientIpForwardingInterceptor } from "../client-ip-forwarding/client-ip-forwarding.interceptor";
import { createChildContainer } from "../container/createContainer";
import { createAppRootContainer } from "./app-di-container";

const rootContainer = createAppRootContainer({
  runtimeEnv: "nodejs",
  // Server-side calls to the Console API hit the absolute upstream URL directly;
  // there's no Next /api/proxy hop on the server. Defaults to https://console-api.akash.network.
  BASE_API_MAINNET_URL: serverEnvConfig.NEXT_PUBLIC_API_BASE_URL,
  globalRequestMiddleware: clientIpForwardingInterceptor,
  apiUrlService: () => new ApiUrlService(serverEnvConfig)
});

export const services = createChildContainer(rootContainer, {
  privateConfig: () => Object.freeze(serverEnvConfig),
  consoleApiHttpClient: () => services.applyAxiosInterceptors(services.createAxios())
});

export type AppServices = typeof services;
