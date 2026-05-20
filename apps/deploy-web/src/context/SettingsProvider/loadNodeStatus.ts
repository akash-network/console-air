import { createFetchAdapter } from "@akashnetwork/http-sdk";
import type { AxiosInstance } from "axios";
import { ConstantBackoff, handleAll, retry } from "cockatiel";

import type { NodeStatusApiResponse } from "@src/lib/nextjs/nodeStatus/nodeStatus.handler";
import type { AbciInfo, NodeStatus } from "@src/types/node";

const fetchAdapter = createFetchAdapter({
  circuitBreaker: {
    halfOpenAfter: 5 * 1000
  }
});

// Require 2 consecutive failures before treating a node as inactive — a single transient
// timeout/blip shouldn't flip the "Blockchain unavailable" banner. In cockatiel, `maxAttempts`
// counts retries after the initial call, so `1` yields exactly 2 total attempts.
const nodeStatusRetryPolicy = retry(handleAll, { maxAttempts: 1, backoff: new ConstantBackoff(1000) });

export type NodeStatusResult = {
  latency: number;
  status: "active" | "inactive";
  nodeInfo: NodeStatus | null;
  appVersion: string | undefined;
};

/**
 * Direct browser → RPC node health check. Use this for custom nodes (the user configured them, so
 * their browser is expected to reach them). For the configured public networks, use
 * `loadProxiedNodeStatus` instead so the check runs same-origin and avoids the regional CORS /
 * Cloudflare-POP failures that flip the banner for affected users.
 */
export async function loadNodeStatus(rpcUrl: string, externalApiHttpClient: AxiosInstance): Promise<NodeStatusResult> {
  const start = performance.now();
  let status: "active" | "inactive" = "inactive";
  let nodeStatus: NodeStatus | null = null;
  let nodeAppVersion: string | undefined;

  try {
    const result = await nodeStatusRetryPolicy.execute(async () => {
      const [statusResponse, abciInfoResponse] = await Promise.all([
        externalApiHttpClient.get<{ result: NodeStatus }>(`${rpcUrl}/status`, {
          timeout: 5000,
          adapter: fetchAdapter
        }),
        externalApiHttpClient.get<{ result: AbciInfo }>(`${rpcUrl}/abci_info`, {
          timeout: 5000,
          adapter: fetchAdapter
        })
      ]);
      return {
        nodeStatus: statusResponse.data.result,
        nodeAppVersion: abciInfoResponse.data.result.response.version
      };
    });
    nodeStatus = result.nodeStatus;
    nodeAppVersion = result.nodeAppVersion;
    status = "active";
  } catch (error) {
    status = "inactive";
  }

  const end = performance.now();
  const latency = end - start;

  return {
    latency,
    status,
    nodeInfo: nodeStatus,
    appVersion: nodeAppVersion
  };
}

/**
 * Same-origin health check via the Next.js `/api/node-status` route. The server runs the RPC fetch
 * from its own network, so users behind a Cloudflare POP / corporate proxy / ISP filter that
 * blocks `rpc.akt.dev` directly will still get a correct answer.
 */
export async function loadProxiedNodeStatus(network: string, externalApiHttpClient: AxiosInstance): Promise<NodeStatusResult> {
  const start = performance.now();
  let status: "active" | "inactive" = "inactive";
  let nodeStatus: NodeStatus | null = null;
  let nodeAppVersion: string | undefined;

  try {
    const result = await nodeStatusRetryPolicy.execute(async () => {
      const response = await externalApiHttpClient.get<NodeStatusApiResponse>(`/api/node-status?network=${encodeURIComponent(network)}`, {
        timeout: 10_000,
        adapter: fetchAdapter
      });
      if (response.data.status !== "active") {
        throw new Error("Upstream chain RPC reported inactive");
      }
      return {
        nodeStatus: response.data.nodeInfo,
        nodeAppVersion: response.data.appVersion
      };
    });
    nodeStatus = result.nodeStatus;
    nodeAppVersion = result.nodeAppVersion;
    status = "active";
  } catch (error) {
    status = "inactive";
  }

  const end = performance.now();
  const latency = end - start;

  return {
    latency,
    status,
    nodeInfo: nodeStatus,
    appVersion: nodeAppVersion
  };
}
