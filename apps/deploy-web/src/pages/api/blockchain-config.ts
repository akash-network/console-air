import type { NextApiRequest, NextApiResponse } from "next";

import { getChainRestUrl, isSupportedChainNetwork } from "@src/lib/nextjs/chainEndpoints/chainEndpoints";

// The returned api/rpc URLs point at console-air's own same-origin proxy routes instead of
// the upstream chain endpoints directly. This bypasses regional CORS / corporate-firewall
// issues that previously caused users to see "Blockchain unavailable" even when the chain
// was up. The `id` is still derived from the upstream hostname so the UI keeps showing a
// human-meaningful node label (e.g. "rpc.akt.dev").
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const network = req.query.network as string;

  if (!isSupportedChainNetwork(network)) {
    res.status(422).json({ error: `Invalid network: ${network}` });
    return;
  }

  try {
    const node = {
      api: `/api/proxy/akash-rest/${network}`,
      rpc: `/api/proxy/akash-rpc/${network}`,
      id: new URL(getChainRestUrl(network)).hostname
    };
    res.status(200).json([node]);
  } catch (error) {
    res.status(500).json({ error: `Network ${network} not supported` });
  }
}
