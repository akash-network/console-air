export { templatesProxyHandler as default } from "@src/lib/nextjs/templatesProxy/templatesProxy.handler";

export const config = {
  api: {
    externalResolver: true,
    bodyParser: false
  }
};
