import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { extractUpstreamPath, templatesProxyHandler } from "./templatesProxy.handler";

const proxyRequestMock = vi.fn();
vi.mock("@src/lib/nextjs/proxyRequest/proxyRequest", () => ({
  proxyRequest: (req: NextApiRequest, res: NextApiResponse, options: { target: string }) => proxyRequestMock(req, res, options)
}));

const envConfig: { NEXT_PUBLIC_BASE_TEMPLATES_URL: string | undefined } = { NEXT_PUBLIC_BASE_TEMPLATES_URL: "https://akash-templates.pages.dev" };
vi.mock("@src/config/browser-env.config", () => ({
  get browserEnvConfig() {
    return envConfig;
  }
}));

function makeReq(url: string): NextApiRequest {
  return { url, query: {}, method: "GET", headers: {} } as unknown as NextApiRequest;
}

function makeRes() {
  const status = vi.fn();
  const json = vi.fn();
  const res = { status, json } as unknown as NextApiResponse;
  status.mockReturnValue(res);
  json.mockReturnValue(res);
  return { res, status, json };
}

describe(extractUpstreamPath.name, () => {
  it("strips the prefix and preserves the remainder", () => {
    expect(extractUpstreamPath("/api/proxy/templates/v1/templates-list.json")).toBe("/v1/templates-list.json");
  });

  it("returns / for a bare base request", () => {
    expect(extractUpstreamPath("/api/proxy/templates")).toBe("/");
  });

  it("preserves query strings", () => {
    expect(extractUpstreamPath("/api/proxy/templates/v1/templates-list.json?v=2")).toBe("/v1/templates-list.json?v=2");
  });

  it("returns null when the prefix does not match", () => {
    expect(extractUpstreamPath("/api/proxy/akash-rpc/mainnet/status")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(extractUpstreamPath(undefined)).toBeNull();
  });
});

describe(templatesProxyHandler.name, () => {
  beforeEach(() => {
    envConfig.NEXT_PUBLIC_BASE_TEMPLATES_URL = "https://akash-templates.pages.dev";
  });

  afterEach(() => {
    proxyRequestMock.mockReset();
  });

  it("forwards templates-list.json to the upstream", async () => {
    const { res } = makeRes();

    await templatesProxyHandler(makeReq("/api/proxy/templates/v1/templates-list.json"), res);

    expect(proxyRequestMock).toHaveBeenCalledTimes(1);
    const options = proxyRequestMock.mock.calls[0][2] as { target: string };
    expect(options.target).toBe("https://akash-templates.pages.dev/v1/templates-list.json");
  });

  it("forwards a specific template fetch to the upstream", async () => {
    const { res } = makeRes();

    await templatesProxyHandler(makeReq("/api/proxy/templates/v1/templates/akash-hello-world.json"), res);

    const options = proxyRequestMock.mock.calls[0][2] as { target: string };
    expect(options.target).toBe("https://akash-templates.pages.dev/v1/templates/akash-hello-world.json");
  });

  it("strips a trailing slash from the upstream base before appending the path", async () => {
    envConfig.NEXT_PUBLIC_BASE_TEMPLATES_URL = "https://akash-templates.pages.dev/";
    const { res } = makeRes();

    await templatesProxyHandler(makeReq("/api/proxy/templates/v1/templates-list.json"), res);

    const options = proxyRequestMock.mock.calls[0][2] as { target: string };
    expect(options.target).toBe("https://akash-templates.pages.dev/v1/templates-list.json");
  });

  it("returns 500 when NEXT_PUBLIC_BASE_TEMPLATES_URL is not configured", async () => {
    envConfig.NEXT_PUBLIC_BASE_TEMPLATES_URL = undefined;
    const { res, status, json } = makeRes();

    await templatesProxyHandler(makeReq("/api/proxy/templates/v1/templates-list.json"), res);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: "Templates base URL is not configured" });
    expect(proxyRequestMock).not.toHaveBeenCalled();
  });
});
