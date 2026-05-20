import type { NextApiRequest, NextApiResponse } from "next";

import { getChainRestUrl, getChainRpcUrl, isSupportedChainNetwork } from "@src/lib/nextjs/chainEndpoints/chainEndpoints";
import { proxyRequest } from "@src/lib/nextjs/proxyRequest/proxyRequest";

export type ChainProxyKind = "rest" | "rpc";

const URL_GETTER: Record<ChainProxyKind, (network: "mainnet" | "sandbox") => string> = {
  rest: getChainRestUrl,
  rpc: getChainRpcUrl
};

export function createChainProxyHandler(kind: ChainProxyKind) {
  return async function chainProxyHandler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    const network = String(req.query.network || "");
    if (!isSupportedChainNetwork(network)) {
      res.status(422).json({ error: `Invalid network: ${network}` });
      return;
    }

    const upstreamPath = extractUpstreamPath(req.url, kind, network);
    if (upstreamPath === null) {
      res.status(400).json({ error: "Could not resolve upstream path" });
      return;
    }

    const upstreamBase = URL_GETTER[kind](network);
    const target = upstreamBase + upstreamPath;

    await proxyRequest(req, res, {
      target,
      onError: error => {
        console.error("CHAIN_PROXY_ERROR", kind, network, error);
      }
    });
  };
}

// /api/proxy/akash-{kind}/{network}/{...rest}?{query}  →  "/{...rest}?{query}"
// Keeps the leading slash if rest is empty (so we hit the upstream root).
export function extractUpstreamPath(rawUrl: string | undefined, kind: ChainProxyKind, network: string): string | null {
  if (!rawUrl) return null;
  const prefix = `/api/proxy/akash-${kind}/${network}`;
  if (!rawUrl.startsWith(prefix)) return null;
  const remainder = rawUrl.slice(prefix.length);
  if (remainder.length === 0) return "/";
  // remainder always starts with "/" or "?" — both are valid as the path component of a URL.
  return remainder;
}
