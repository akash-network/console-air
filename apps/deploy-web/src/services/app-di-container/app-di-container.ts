import { certificateManager } from "@akashnetwork/chain-sdk/web";
import type { HttpClientOptions } from "@akashnetwork/http-sdk";
import {
  ApiKeyHttpService,
  createHttpClient,
  DeploymentSettingHttpService,
  isHttpError,
  TemplateHttpService,
  UsageHttpService,
  WalletSettingsHttpService
} from "@akashnetwork/http-sdk";
import { LoggerService } from "@akashnetwork/logging";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import type { Axios, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from "axios";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { UrlReturnToStack } from "@src/hooks/useReturnTo/UrlReturnToStack";
import { AnalyticsService } from "@src/services/analytics/analytics.service";
import networkStore from "@src/store/networkStore";
import { UrlService } from "@src/utils/urlUtils";
import type { ApiUrlService } from "../api-url/api-url.service";
import { createContainer } from "../container/createContainer";
import { ErrorHandlerService } from "../error-handler/error-handler.service";
import { ProviderProxyService } from "../provider-proxy/provider-proxy.service";
import { UserTracker } from "../user-tracker/user-tracker.service";

export const createAppRootContainer = (config: ServicesConfig) => {
  const apiConfig = { baseURL: config.BASE_API_MAINNET_URL, adapter: "fetch" as const };
  const container = createContainer({
    publicConfig: () => browserEnvConfig,

    applyAxiosInterceptors: (): typeof withInterceptors => {
      const otelInterceptor = (config: InternalAxiosRequestConfig) => {
        if (typeof window !== "undefined" && getRequestOrigin(config) !== window.location.origin) {
          // skip OTEL headers for cross-origin requests in browser because it may fail due to CORS policy
          return config;
        }
        const traceData = container.errorHandler.getTraceData();
        if (traceData.traceIdW3C) config.headers.set("traceparent", traceData.traceIdW3C);
        if (traceData?.baggage) config.headers.set("Baggage", traceData.baggage);
        return config;
      };
      return (axiosInstance, interceptors?) =>
        withInterceptors(axiosInstance, {
          request: [config.globalRequestMiddleware, otelInterceptor, ...(interceptors?.request || [])],
          response: [...(interceptors?.response || [])]
        });
    },
    template: () => {
      // In the browser we route templates through the Next /api/proxy/templates route so the
      // request stays same-origin. Without this, users on certain regional Cloudflare POPs see
      // the OPTIONS preflight to akash-templates.pages.dev fail ("CORS Missing Allow Header"),
      // which leaves the templates dropdown empty. The server-side path keeps hitting the
      // upstream directly (no proxy hop) since CORS doesn't apply to server-side fetches.
      const baseURL = config.runtimeEnv === "browser" ? "/api/proxy/templates" : container.publicConfig.NEXT_PUBLIC_BASE_TEMPLATES_URL;
      const httpClient = container.createAxios({ baseURL });
      return new TemplateHttpService(httpClient);
    },
    usage: () => container.applyAxiosInterceptors(new UsageHttpService(apiConfig)),
    networkStore: () => networkStore,
    providerProxy: () => {
      const network = () => container.networkStore.selectedNetworkId;
      // HTTP requests are proxied through the Next /api/provider-proxy/{network} route
      // so the browser stays same-origin (no CORS preflight). WebSockets bypass that
      // route since Next API routes can't upgrade — they hit the upstream directly.
      const getHttpBaseUrl = () => (config.runtimeEnv === "browser" ? `/api/provider-proxy/${network()}` : config.BASE_PROVIDER_PROXY_URL.replace("%{NETWORK}", network()));
      const getWebSocketUrl = () => config.BASE_PROVIDER_PROXY_URL.replace("%{NETWORK}", network()).replace(/^http/, "ws");
      return new ProviderProxyService(
        container.applyAxiosInterceptors(container.createAxios({ baseURL: "/" }), {
          request: [config => ({ ...config, baseURL: getHttpBaseUrl() })]
        }),
        container.logger,
        () => new WebSocket(getWebSocketUrl())
      );
    },
    deploymentSetting: () =>
      container.applyAxiosInterceptors(new DeploymentSettingHttpService(apiConfig)),
    walletSettings: () =>
      container.applyAxiosInterceptors(new WalletSettingsHttpService(apiConfig)),
    apiKey: () =>
      container.applyAxiosInterceptors(new ApiKeyHttpService(apiConfig)),
    externalApiHttpClient: () => {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json"
      };
      if (config.runtimeEnv === "nodejs") {
        headers["User-Agent"] = `ConsoleAir/1.0 (${browserEnvConfig.NEXT_PUBLIC_APP_URL})`;
      }

      return container.createAxios({
        headers
      });
    },
    createAxios:
      () =>
      (options?: HttpClientOptions): AxiosInstance =>
        createHttpClient(options),
    certificateManager: () => certificateManager,
    analyticsService: () => new AnalyticsService(),
    apiUrlService: config.apiUrlService,
    queryClient: () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry(failureCount, error) {
              return isHttpError(error) && !!error.response && error.response.status >= 500 && failureCount < 3;
            }
          }
        },
        queryCache: new QueryCache({
          onError: error => container.errorHandler.reportError({ error })
        }),
        mutationCache: new MutationCache({
          onError: error => container.errorHandler.reportError({ error })
        })
      }),
    errorHandler: () => new ErrorHandlerService(container.logger),
    logger: () =>
      new LoggerService({
        name: `app-${config.runtimeEnv}`,
        browser: {
          disabled: config.runtimeEnv !== "browser",
          // enable serialization of log events, so then we can see more details about errors in Sentry
          serialize: true,
          asObject: true
        }
      }),
    urlService: () => UrlService,
    urlReturnToStack: () => UrlReturnToStack,
    userTracker: () => new UserTracker()
  });

  return container;
};

export interface ServicesConfig {
  BASE_API_MAINNET_URL: string;
  BASE_PROVIDER_PROXY_URL: string;
  globalRequestMiddleware?: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig;
  runtimeEnv: "nodejs" | "browser";
  apiUrlService: () => ApiUrlService;
}

export function withInterceptors<T extends Axios | AxiosInstance = AxiosInstance>(axios: T, interceptors?: Interceptors) {
  interceptors?.request?.forEach(interceptor => axios.interceptors.request.use(interceptor));
  interceptors?.response?.forEach(interceptor => axios.interceptors.response.use(interceptor));
  return axios;
}

type Interceptor<T> = (value: T) => T | Promise<T>;
interface Interceptors {
  request?: Array<Interceptor<InternalAxiosRequestConfig> | undefined>;
  response?: Array<Interceptor<AxiosResponse> | undefined>;
}

function getRequestOrigin(config: InternalAxiosRequestConfig) {
  if (config.url?.startsWith("http")) return new URL(config.url).origin;

  let baseUrl = config.baseURL ?? "";
  if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);
  let url = config.url ?? "";
  if (!url.startsWith("/")) url = `/${url}`;
  const fullUrl = baseUrl + url;
  return fullUrl.startsWith("http") ? new URL(fullUrl).origin : window.location.origin;
}
