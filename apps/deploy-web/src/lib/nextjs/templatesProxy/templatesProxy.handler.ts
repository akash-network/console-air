import type { NextApiRequest, NextApiResponse } from "next";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { proxyRequest } from "@src/lib/nextjs/proxyRequest/proxyRequest";

const PROXY_PREFIX = "/api/proxy/templates";

// Templates live at NEXT_PUBLIC_BASE_TEMPLATES_URL (default applied by the zod schema in
// env-config.schema.ts: https://akash-templates.pages.dev). browserEnvConfig is the parsed
// view, so an unset env var resolves to the production default rather than undefined.
function getTemplatesBaseUrl(): string | undefined {
  return browserEnvConfig.NEXT_PUBLIC_BASE_TEMPLATES_URL;
}

export async function templatesProxyHandler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const baseUrl = getTemplatesBaseUrl();
  if (!baseUrl) {
    res.status(500).json({ error: "Templates base URL is not configured" });
    return;
  }

  const upstreamPath = extractUpstreamPath(req.url);
  if (upstreamPath === null) {
    res.status(400).json({ error: "Could not resolve upstream path" });
    return;
  }

  await proxyRequest(req, res, {
    target: stripTrailingSlash(baseUrl) + upstreamPath,
    onError: error => {
      console.error("TEMPLATES_PROXY_ERROR", error);
    }
  });
}

// /api/proxy/templates/{...rest}?{query}  →  "/{...rest}?{query}"
// Returns "/" for a bare base request.
export function extractUpstreamPath(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  if (!rawUrl.startsWith(PROXY_PREFIX)) return null;
  const remainder = rawUrl.slice(PROXY_PREFIX.length);
  if (remainder.length === 0) return "/";
  return remainder;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
