import type { IncomingHttpHeaders } from "http";
import type { NextApiRequest, NextApiResponse } from "next";
import { PassThrough, Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import { proxyRequest } from "./proxyRequest";

function makeReq(opts?: { method?: string; headers?: IncomingHttpHeaders; body?: Buffer }): NextApiRequest {
  const headers = opts?.headers ?? {};
  const body = opts?.body;
  const stream = Readable.from(body ? [body] : []);
  const req = stream as unknown as NextApiRequest;
  (req as any).method = opts?.method ?? "GET";
  (req as any).headers = headers;
  return req;
}

function makeRes() {
  const sink = new PassThrough();
  const chunks: Buffer[] = [];
  sink.on("data", c => chunks.push(c));
  const writeHead = vi.fn().mockImplementation(function (this: any, status: number, headers?: Record<string, string>) {
    this.statusCode = status;
    this.__headers = headers;
    return this;
  });
  const res = sink as unknown as NextApiResponse & { __headers?: Record<string, string>; __chunks: Buffer[] };
  (res as any).statusCode = 200;
  (res as any).headersSent = false;
  (res as any).writeHead = writeHead;
  (res as any).__chunks = chunks;
  return { res, writeHead, chunks };
}

function makeFetchResponse(body: Uint8Array | string | null, init?: { status?: number; headers?: Record<string, string> }) {
  const headers = new Headers(init?.headers);
  const stream = body === null
    ? null
    : new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(typeof body === "string" ? new TextEncoder().encode(body) : body);
          controller.close();
        }
      });
  return new Response(stream, { status: init?.status ?? 200, headers });
}

describe(proxyRequest.name, () => {
  it("forces accept-encoding=identity on the upstream request and drops the browser's value", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeFetchResponse('{"ok":true}', { headers: { "content-type": "application/json" } }));
    const { res } = makeRes();

    await proxyRequest(
      makeReq({ headers: { "accept-encoding": "gzip, deflate, br", "x-keepme": "yes" } }),
      res,
      { target: "https://upstream.example/x", fetch: fetchMock as any }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sentHeaders = fetchMock.mock.calls[0][1].headers as Headers;
    expect(sentHeaders.get("accept-encoding")).toBe("identity");
    expect(sentHeaders.get("x-keepme")).toBe("yes");
  });

  it("strips content-encoding and content-length from the response before piping to the client", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeFetchResponse('{"ok":true}', {
        headers: {
          "content-type": "application/json",
          // A non-compliant upstream that ignores accept-encoding=identity. We must still
          // not lie to the browser about encoding (which would have caused JSON.parse errors).
          "content-encoding": "gzip",
          "content-length": "42"
        }
      })
    );
    const { res, writeHead } = makeRes();

    await proxyRequest(makeReq(), res, { target: "https://upstream.example/x", fetch: fetchMock as any });

    expect(writeHead).toHaveBeenCalledTimes(1);
    const passedHeaders = writeHead.mock.calls[0][1] as Record<string, string>;
    expect(passedHeaders["content-encoding"]).toBeUndefined();
    expect(passedHeaders["content-length"]).toBeUndefined();
    expect(passedHeaders["content-type"]).toBe("application/json");
  });

  it("returns 502 when the upstream fetch throws and headers have not been sent", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("boom"));
    const { res } = makeRes();
    const onError = vi.fn();

    await proxyRequest(makeReq(), res, { target: "https://upstream.example/x", fetch: fetchMock as any, onError });

    expect((res as any).statusCode).toBe(502);
    expect(onError).toHaveBeenCalled();
  });

  it("buffers a POST request body and forwards it as-is", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeFetchResponse('{"ok":true}', { headers: { "content-type": "application/json" } }));
    const { res } = makeRes();
    const body = Buffer.from(JSON.stringify({ method: "broadcast_tx_sync" }));

    await proxyRequest(
      makeReq({ method: "POST", headers: { "content-type": "application/json", "content-length": String(body.byteLength) }, body }),
      res,
      { target: "https://upstream.example/", fetch: fetchMock as any }
    );

    const sentBody = fetchMock.mock.calls[0][1].body as Buffer;
    expect(Buffer.isBuffer(sentBody)).toBe(true);
    expect(sentBody.toString()).toBe(body.toString());
  });
});
