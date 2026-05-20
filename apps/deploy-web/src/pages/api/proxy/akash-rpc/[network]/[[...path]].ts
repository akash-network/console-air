import { createChainProxyHandler } from "@src/lib/nextjs/chainProxy/chainProxy.handler";

export default createChainProxyHandler("rpc");

export const config = {
  api: {
    externalResolver: true,
    bodyParser: false
  }
};
