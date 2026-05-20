import { netConfig } from "@akashnetwork/net";
import type { NextApiRequest, NextApiResponse } from "next";

import type { AbciInfo, NodeStatus } from "@src/types/node";

const SUPPORTED_NETWORKS = new Set(["mainnet", "sandbox"]);

// Same source of truth as /api/blockchain-config — keep these in sync if mainnet ever switches RPC.
function getRpcUrlFor(network: string): string {
  if (network === "mainnet") return "https://rpc.akt.dev/rpc";
  return netConfig.getBaseRpcUrl(network);
}

export type NodeStatusApiResponse =
  | { status: "active"; nodeInfo: NodeStatus; appVersion: string | undefined }
  | { status: "inactive"; nodeInfo: null; appVersion?: undefined };

const UPSTREAM_TIMEOUT_MS = 5000;

export async function nodeStatusHandler(req: NextApiRequest, res: NextApiResponse<NodeStatusApiResponse | { error: string }>): Promise<void> {
  const network = String(req.query.network || "");

  if (!SUPPORTED_NETWORKS.has(network)) {
    res.status(422).json({ error: `Invalid network: ${network}` });
    return;
  }

  const rpcUrl = getRpcUrlFor(network);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const [statusResponse, abciInfoResponse] = await Promise.all([
      fetch(`${rpcUrl}/status`, { signal: controller.signal }),
      fetch(`${rpcUrl}/abci_info`, { signal: controller.signal })
    ]);

    if (!statusResponse.ok || !abciInfoResponse.ok) {
      throw new Error(`Upstream returned ${statusResponse.status}/${abciInfoResponse.status}`);
    }

    const statusBody = (await statusResponse.json()) as { result: NodeStatus };
    const abciBody = (await abciInfoResponse.json()) as { result: AbciInfo };

    res.status(200).json({
      status: "active",
      nodeInfo: statusBody.result,
      appVersion: abciBody.result.response.version
    });
  } catch (_error) {
    // Browser-side caller treats a 502 as "retry" via cockatiel. Two consecutive 502s flip
    // isBlockchainDown, matching the original 2-attempt behavior — only this time the network
    // path is console-air's server, not the user's browser, so CORS/POP issues on the user's
    // side cannot trigger a false positive.
    res.status(502).json({ status: "inactive", nodeInfo: null });
  } finally {
    clearTimeout(timeoutId);
  }
}
