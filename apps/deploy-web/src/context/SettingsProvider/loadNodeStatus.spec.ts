import type { AxiosInstance } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { loadNodeStatus, loadProxiedNodeStatus } from "./loadNodeStatus";

const RPC_URL = "https://rpc.example/rpc";

const okStatus = { data: { result: { sync_info: { catching_up: false } } } };
const okAbci = { data: { result: { response: { version: "0.38.19" } } } };
const okProxyResponse = {
  data: {
    status: "active" as const,
    nodeInfo: { sync_info: { catching_up: false } },
    appVersion: "0.38.19"
  }
};

describe(loadNodeStatus.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns active when both /status and /abci_info succeed on first try", async () => {
    const { client } = setup();
    client.get.mockResolvedValueOnce(okStatus as never);
    client.get.mockResolvedValueOnce(okAbci as never);

    const result = await loadNodeStatus(RPC_URL, client);

    expect(result.status).toBe("active");
    expect(result.nodeInfo).toEqual(okStatus.data.result);
    expect(result.appVersion).toBe("0.38.19");
    expect(client.get).toHaveBeenCalledTimes(2);
    expect(client.get).toHaveBeenCalledWith(`${RPC_URL}/status`, expect.objectContaining({ timeout: 5000 }));
    expect(client.get).toHaveBeenCalledWith(`${RPC_URL}/abci_info`, expect.objectContaining({ timeout: 5000 }));
  });

  it("retries once and returns active when the first attempt fails transiently", async () => {
    const { client } = setup();
    // First attempt: /status rejects → whole Promise.all rejects → cockatiel retries.
    client.get.mockRejectedValueOnce(new Error("transient"));
    // The other parallel call also resolves (Promise.all rejects fast on first reject either way).
    client.get.mockResolvedValueOnce(okAbci as never);
    // Second attempt (retry): both succeed.
    client.get.mockResolvedValueOnce(okStatus as never);
    client.get.mockResolvedValueOnce(okAbci as never);

    const result = await loadNodeStatus(RPC_URL, client);

    expect(result.status).toBe("active");
    expect(result.appVersion).toBe("0.38.19");
    // 2 calls for the failed attempt + 2 calls for the retry = 4 total
    expect(client.get).toHaveBeenCalledTimes(4);
  });

  it("returns inactive only after both attempts fail (2 consecutive failures)", async () => {
    const { client } = setup();
    client.get.mockRejectedValue(new Error("down"));

    const result = await loadNodeStatus(RPC_URL, client);

    expect(result.status).toBe("inactive");
    expect(result.nodeInfo).toBeNull();
    expect(result.appVersion).toBeUndefined();
    // 2 calls per attempt × 2 attempts (1 initial + 1 retry) = 4 total
    expect(client.get).toHaveBeenCalledTimes(4);
  });

  it("does not flip to inactive when only the first attempt times out", async () => {
    const { client } = setup({ useFakeTimers: true });
    // First attempt rejects, retry succeeds. Fast-forward the 1s backoff so the test doesn't hang.
    client.get.mockRejectedValueOnce(new Error("timeout"));
    client.get.mockResolvedValueOnce(okAbci as never);
    client.get.mockResolvedValueOnce(okStatus as never);
    client.get.mockResolvedValueOnce(okAbci as never);

    const promise = loadNodeStatus(RPC_URL, client);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe("active");
  });

  function setup(input?: { useFakeTimers?: boolean }) {
    if (input?.useFakeTimers) {
      vi.useFakeTimers();
    }
    const client = mock<AxiosInstance>();
    return { client };
  }
});

describe(loadProxiedNodeStatus.name, () => {
  it("hits /api/node-status?network=<id> and returns active on a healthy proxy response", async () => {
    const { client } = setup();
    client.get.mockResolvedValueOnce(okProxyResponse as never);

    const result = await loadProxiedNodeStatus("mainnet", client);

    expect(result.status).toBe("active");
    expect(result.nodeInfo).toEqual(okProxyResponse.data.nodeInfo);
    expect(result.appVersion).toBe("0.38.19");
    expect(client.get).toHaveBeenCalledTimes(1);
    expect(client.get).toHaveBeenCalledWith("/api/node-status?network=mainnet", expect.objectContaining({ timeout: 10_000 }));
  });

  it("URL-encodes the network id", async () => {
    const { client } = setup();
    client.get.mockResolvedValueOnce(okProxyResponse as never);

    await loadProxiedNodeStatus("foo bar", client);

    expect(client.get).toHaveBeenCalledWith("/api/node-status?network=foo%20bar", expect.any(Object));
  });

  it("retries once on a 5xx (proxy upstream failure) and returns active when the retry succeeds", async () => {
    const { client } = setup();
    client.get.mockRejectedValueOnce(Object.assign(new Error("Bad Gateway"), { response: { status: 502 } }));
    client.get.mockResolvedValueOnce(okProxyResponse as never);

    const result = await loadProxiedNodeStatus("mainnet", client);

    expect(result.status).toBe("active");
    expect(client.get).toHaveBeenCalledTimes(2);
  });

  it("returns inactive only after 2 consecutive failures", async () => {
    const { client } = setup();
    client.get.mockRejectedValue(Object.assign(new Error("Bad Gateway"), { response: { status: 502 } }));

    const result = await loadProxiedNodeStatus("mainnet", client);

    expect(result.status).toBe("inactive");
    expect(result.nodeInfo).toBeNull();
    expect(client.get).toHaveBeenCalledTimes(2);
  });

  it("treats a 200 with status='inactive' body as a failure (and retries)", async () => {
    const { client } = setup();
    client.get.mockResolvedValueOnce({ data: { status: "inactive", nodeInfo: null } } as never);
    client.get.mockResolvedValueOnce(okProxyResponse as never);

    const result = await loadProxiedNodeStatus("mainnet", client);

    expect(result.status).toBe("active");
    expect(client.get).toHaveBeenCalledTimes(2);
  });

  function setup() {
    const client = mock<AxiosInstance>();
    return { client };
  }
});
