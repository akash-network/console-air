import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createChainProxyHandler, extractUpstreamPath } from "./chainProxy.handler";

const proxyRequestMock = vi.fn();
vi.mock("@src/lib/nextjs/proxyRequest/proxyRequest", () => ({
  proxyRequest: (req: NextApiRequest, res: NextApiResponse, options: { target: string }) => proxyRequestMock(req, res, options)
}));

function makeReq(opts: { url: string; query: Record<string, string | string[]>; method?: string }): NextApiRequest {
  return { url: opts.url, query: opts.query, method: opts.method ?? "GET", headers: {} } as unknown as NextApiRequest;
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
  it("strips the proxy prefix and preserves the remainder including query", () => {
    expect(extractUpstreamPath("/api/proxy/akash-rest/mainnet/cosmos/bank/v1beta1/balances/akash1abc?denom=uakt", "rest", "mainnet")).toBe(
      "/cosmos/bank/v1beta1/balances/akash1abc?denom=uakt"
    );
  });

  it("returns / for a root request with no remainder", () => {
    expect(extractUpstreamPath("/api/proxy/akash-rpc/mainnet", "rpc", "mainnet")).toBe("/");
  });

  it("preserves a bare query string when the path is empty", () => {
    expect(extractUpstreamPath("/api/proxy/akash-rpc/sandbox?height=42", "rpc", "sandbox")).toBe("?height=42");
  });

  it("returns null when the prefix does not match (defense against confused routing)", () => {
    expect(extractUpstreamPath("/api/proxy/akash-rpc/mainnet/x", "rest", "mainnet")).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(extractUpstreamPath(undefined, "rest", "mainnet")).toBeNull();
  });
});

describe("createChainProxyHandler", () => {
  afterEach(() => {
    proxyRequestMock.mockReset();
  });

  it("returns 422 for an unsupported network and never invokes proxyRequest", async () => {
    const handler = createChainProxyHandler("rest");
    const { res, status, json } = makeRes();

    await handler(makeReq({ url: "/api/proxy/akash-rest/ethereum/anything", query: { network: "ethereum", path: ["anything"] } }), res);

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith({ error: "Invalid network: ethereum" });
    expect(proxyRequestMock).not.toHaveBeenCalled();
  });

  it("forwards mainnet REST requests to https://rpc.akt.dev/rest + remaining path", async () => {
    const handler = createChainProxyHandler("rest");
    const { res } = makeRes();

    await handler(
      makeReq({
        url: "/api/proxy/akash-rest/mainnet/cosmos/auth/v1beta1/accounts/akash1abc",
        query: { network: "mainnet", path: ["cosmos", "auth", "v1beta1", "accounts", "akash1abc"] }
      }),
      res
    );

    expect(proxyRequestMock).toHaveBeenCalledTimes(1);
    const options = proxyRequestMock.mock.calls[0][2] as { target: string };
    expect(options.target).toBe("https://rpc.akt.dev/rest/cosmos/auth/v1beta1/accounts/akash1abc");
  });

  it("forwards mainnet RPC requests to https://rpc.akt.dev/rpc + remaining path", async () => {
    const handler = createChainProxyHandler("rpc");
    const { res } = makeRes();

    await handler(
      makeReq({
        url: "/api/proxy/akash-rpc/mainnet/status",
        query: { network: "mainnet", path: ["status"] }
      }),
      res
    );

    const options = proxyRequestMock.mock.calls[0][2] as { target: string };
    expect(options.target).toBe("https://rpc.akt.dev/rpc/status");
  });

  it("forwards POST broadcast_tx_commit to the RPC upstream", async () => {
    const handler = createChainProxyHandler("rpc");
    const { res } = makeRes();

    await handler(
      makeReq({
        url: "/api/proxy/akash-rpc/mainnet/broadcast_tx_commit",
        query: { network: "mainnet", path: ["broadcast_tx_commit"] },
        method: "POST"
      }),
      res
    );

    const options = proxyRequestMock.mock.calls[0][2] as { target: string };
    expect(options.target).toBe("https://rpc.akt.dev/rpc/broadcast_tx_commit");
  });
});
