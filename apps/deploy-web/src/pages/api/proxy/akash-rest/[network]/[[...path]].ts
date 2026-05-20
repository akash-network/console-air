import { createChainProxyHandler } from "@src/lib/nextjs/chainProxy/chainProxy.handler";

export default createChainProxyHandler("rest");

export const config = {
  api: {
    externalResolver: true,
    bodyParser: false
  }
};
