import { z } from "zod";

const networkId = z.enum(["mainnet", "sandbox", "testnet"]);
const coercedBoolean = () => z.enum(["true", "false"]).transform(val => val === "true");

// Treats blank or relative-path values as "missing" so the production default kicks in.
// Self-host instances don't have the Console reverse proxy, so a leftover relative
// path like "/api-mainnet" from an older .env would otherwise resolve against the dev
// origin and 404. Absolute URLs (http://, https://) and the "%{NETWORK}" placeholder
// are passed through untouched.
const productionUrl = (defaultValue: string) =>
  z.preprocess(value => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return undefined;
  }, z.string().url().optional().default(defaultValue));

export const browserEnvSchema = z.object({
  NEXT_PUBLIC_DEFAULT_NETWORK_ID: networkId.optional().default("mainnet"),
  NEXT_PUBLIC_APP_URL: productionUrl("http://localhost:3000"),
  NEXT_PUBLIC_API_BASE_URL: productionUrl("https://console-api.akash.network"),
  NEXT_PUBLIC_API_BASE_URL_SANDBOX: productionUrl("https://console-api-sandbox.akash.network"),
  NEXT_PUBLIC_API_BASE_URL_TESTNET: productionUrl("https://console-api-testnet.akash.network"),
  NEXT_PUBLIC_STATS_APP_URL: productionUrl("https://stats.akash.network"),
  NEXT_PUBLIC_PROVIDER_PROXY_URL: productionUrl("https://console.akash.network/provider-proxy-%{NETWORK}"),
  NEXT_PUBLIC_NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  NEXT_PUBLIC_DEFAULT_INITIAL_DEPOSIT: z.number({ coerce: true }).optional().default(500000),
  NEXT_PUBLIC_BASE_API_MAINNET_URL: productionUrl("https://console.akash.network/api-mainnet"),
  NEXT_PUBLIC_BASE_API_TESTNET_URL: productionUrl("https://console.akash.network/api-testnet"),
  NEXT_PUBLIC_BASE_API_SANDBOX_URL: productionUrl("https://console.akash.network/api-sandbox"),
  NEXT_PUBLIC_BASE_TEMPLATES_URL: productionUrl("https://akash-templates.pages.dev"),
  NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID: z.string().min(1).optional()
});

export const serverEnvSchema = browserEnvSchema.extend({
  MAINTENANCE_MODE: coercedBoolean().optional().default("false"),
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  DEFAULT_REST_API_NODE_URL_MAINNET: z.string().url().optional(),
  DEFAULT_RPC_NODE_URL_MAINNET: z.string().url().optional()
});

export type BrowserEnvConfig = z.infer<typeof browserEnvSchema>;
export type ServerEnvConfig = z.infer<typeof serverEnvSchema>;

export const validateStaticEnvVars = (config: Record<string, unknown>) => browserEnvSchema.parse(config);
export const validateRuntimeEnvVars = (config: Record<string, unknown>) => {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    console.log("Skipping validation of serverEnvConfig during build");
    return config as ServerEnvConfig;
  } else {
    return serverEnvSchema.parse(config);
  }
};
