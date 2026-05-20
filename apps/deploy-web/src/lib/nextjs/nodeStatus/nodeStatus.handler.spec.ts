import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { nodeStatusHandler } from "./nodeStatus.handler";

const MAINNET_RPC = "https://rpc.akt.dev/rpc";

function jsonResponse(body: unknown, init?: { status?: number }) {
  return new Response(JSON.stringify(body), { status: init?.status ?? 200, headers: { "content-type": "application/json" } });
}

describe(nodeStatusHandler.name, () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns 422 for an unsupported network and never touches fetch", async () => {
    const fetchSpy = vi.fn();
    const { req, res } = setup({ query: { network: "ethereum" }, fetch: fetchSpy as unknown as typeof fetch });

    await nodeStatusHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid network: ethereum" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 200 active + nodeInfo + appVersion when both upstream calls succeed", async () => {
    const nodeInfo = { sync_info: { catching_up: false } };
    const fetchSpy = vi.fn(async (url: string) => {
      if (url === `${MAINNET_RPC}/status`) return jsonResponse({ result: nodeInfo });
      if (url === `${MAINNET_RPC}/abci_info`) return jsonResponse({ result: { response: { version: "0.38.19" } } });
      throw new Error(`unexpected url ${url}`);
    });
    const { req, res } = setup({ query: { network: "mainnet" }, fetch: fetchSpy as unknown as typeof fetch });

    await nodeStatusHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: "active", nodeInfo, appVersion: "0.38.19" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns 502 inactive when one upstream fetch returns a non-ok status", async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      if (url.endsWith("/status")) return jsonResponse({ error: "boom" }, { status: 503 });
      return jsonResponse({ result: { response: { version: "0.38.19" } } });
    });
    const { req, res } = setup({ query: { network: "mainnet" }, fetch: fetchSpy as unknown as typeof fetch });

    await nodeStatusHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ status: "inactive", nodeInfo: null });
  });

  it("returns 502 inactive when the upstream fetch throws (network failure)", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error("network error");
    });
    const { req, res } = setup({ query: { network: "mainnet" }, fetch: fetchSpy as unknown as typeof fetch });

    await nodeStatusHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ status: "inactive", nodeInfo: null });
  });

  function setup(input: { query: Record<string, string>; fetch?: typeof fetch }) {
    if (input.fetch) {
      globalThis.fetch = input.fetch;
    }
    const req = mock<NextApiRequest>({ query: input.query });
    const res = mock<NextApiResponse>();
    res.status.mockReturnValue(res);
    res.json.mockReturnValue(res);
    return { req, res, fetch: globalThis.fetch };
  }
});
