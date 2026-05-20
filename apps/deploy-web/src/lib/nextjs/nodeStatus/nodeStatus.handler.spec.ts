import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";

import { nodeStatusHandler } from "./nodeStatus.handler";

const MAINNET_RPC = "https://rpc.akt.dev/rpc";

function makeReq(query: Record<string, string>): NextApiRequest {
  return { query } as unknown as NextApiRequest;
}

function makeRes() {
  const status = vi.fn();
  const json = vi.fn();
  const res = { status, json } as unknown as NextApiResponse;
  status.mockReturnValue(res);
  json.mockReturnValue(res);
  return { res, status, json };
}

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
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const { res, status, json } = makeRes();
    await nodeStatusHandler(makeReq({ network: "ethereum" }), res);

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith({ error: "Invalid network: ethereum" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 200 active + nodeInfo + appVersion when both upstream calls succeed", async () => {
    const nodeInfo = { sync_info: { catching_up: false } };
    const fetchSpy = vi.fn(async (url: string) => {
      if (url === `${MAINNET_RPC}/status`) return jsonResponse({ result: nodeInfo });
      if (url === `${MAINNET_RPC}/abci_info`) return jsonResponse({ result: { response: { version: "0.38.19" } } });
      throw new Error(`unexpected url ${url}`);
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const { res, status, json } = makeRes();
    await nodeStatusHandler(makeReq({ network: "mainnet" }), res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ status: "active", nodeInfo, appVersion: "0.38.19" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns 502 inactive when one upstream fetch returns a non-ok status", async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      if (url.endsWith("/status")) return jsonResponse({ error: "boom" }, { status: 503 });
      return jsonResponse({ result: { response: { version: "0.38.19" } } });
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const { res, status, json } = makeRes();
    await nodeStatusHandler(makeReq({ network: "mainnet" }), res);

    expect(status).toHaveBeenCalledWith(502);
    expect(json).toHaveBeenCalledWith({ status: "inactive", nodeInfo: null });
  });

  it("returns 502 inactive when the upstream fetch throws (network failure)", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network error");
    }) as unknown as typeof fetch;

    const { res, status, json } = makeRes();
    await nodeStatusHandler(makeReq({ network: "mainnet" }), res);

    expect(status).toHaveBeenCalledWith(502);
    expect(json).toHaveBeenCalledWith({ status: "inactive", nodeInfo: null });
  });
});
