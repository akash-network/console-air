import { netConfig } from "@akashnetwork/net";

export const SUPPORTED_CHAIN_NETWORKS = ["mainnet", "sandbox"] as const;
export type SupportedChainNetwork = (typeof SUPPORTED_CHAIN_NETWORKS)[number];

const SUPPORTED_SET = new Set<string>(SUPPORTED_CHAIN_NETWORKS);

export function isSupportedChainNetwork(network: string): network is SupportedChainNetwork {
  return SUPPORTED_SET.has(network);
}

// Mainnet's RPC/REST host doesn't match netConfig's defaults (the package ships pre-canonical
// URLs). Keep the override here so all server-side chain calls (proxies + /api/node-status)
// resolve the same upstream.
export function getChainRpcUrl(network: SupportedChainNetwork): string {
  if (network === "mainnet") return "https://rpc.akt.dev/rpc";
  return netConfig.getBaseRpcUrl(network);
}

export function getChainRestUrl(network: SupportedChainNetwork): string {
  if (network === "mainnet") return "https://rpc.akt.dev/rest";
  return netConfig.getBaseAPIUrl(network);
}
