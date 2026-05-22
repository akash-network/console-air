import type { NextApiRequest, NextApiResponse } from "next";
import { Writable } from "node:stream";

const HEADERS_TO_SKIP = new Set([
  "connection",
  "proxy-connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "trailer",
  "upgrade",
  "proxy-authenticate",
  "proxy-authorization"
]);

export async function proxyRequest(req: NextApiRequest, res: NextApiResponse, options: ProxyOptions) {
  const abortController = new AbortController();
  const onClose = () => abortController.abort(new Error("client disconnected"));
  req.on("aborted", onClose);
  res.on("close", onClose);

  const signals = [abortController.signal, AbortSignal.timeout(options.timeout ?? 60_000)];
  if (options.signal) signals.push(options.signal);
  const requestSignal = AbortSignal.any(signals);

  try {
    await forwardRequestStream(req, res, { ...options, signal: requestSignal });
  } catch (error) {
    options.onError?.(error as Error);
    // If headers not sent yet, we can send a 502
    if (!res.headersSent) {
      res.statusCode = requestSignal.aborted ? 499 : 502; // 499 = client closed (nginx convention)
      res.end(JSON.stringify({ error: "Proxy error" }));
    } else {
      // Mid-stream error: can only tear down the socket
      res.destroy();
    }
  } finally {
    req.off("aborted", onClose);
    res.off("close", onClose);
  }
}

interface ProxyOptions {
  target: string;
  signal?: AbortSignal;
  /**
   * timeout in milliseconds
   * if not provided, will use 60 seconds
   */
  timeout?: number;
  headers?: HeadersInit;
  fetch?: typeof globalThis.fetch;
  onError?: (error: Error) => void;
}

async function forwardRequestStream(req: NextApiRequest, res: NextApiResponse, options: ProxyOptions) {
  const headers = new Headers(options.headers);

  Object.entries(req.headers).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (headers.has(key)) return;

    const lowKey = key.toLowerCase();
    if (lowKey === "host" || lowKey === "connection" || lowKey === "cookie") return;
    // Forward an explicit "identity" so the upstream returns uncompressed bytes regardless
    // of what the browser asked for. Otherwise we'd be relying on undici's transparent
    // decompression — which works on current Node 22 but has historically lagged for brotli,
    // and which we'd be silently lying about by stripping Content-Encoding on the way back.
    if (lowKey === "accept-encoding") return;
    if (HEADERS_TO_SKIP.has(lowKey)) return;
    if (!Array.isArray(value)) {
      headers.set(key, value);
      return;
    }
    value.forEach(v => headers.append(key, v));
  });
  headers.set("accept-encoding", "identity");

  const method = req.method?.toUpperCase() || "GET";
  const contentLength = Number(req.headers["content-length"]) || 0;
  const hasBody = method !== "GET" && method !== "HEAD" && (contentLength > 0 || req.headers["transfer-encoding"]);

  // We buffer the request body before forwarding instead of piping the Node stream
  // through Readable.toWeb + duplex:"half". The streaming variant is flaky inside
  // Next API routes — Next can close the underlying socket before undici finishes
  // forwarding, which surfaces as ERR_STREAM_PREMATURE_CLOSE here and as a
  // truncated body / 503 at the upstream. The /api/proxy and /api/provider-proxy
  // routes only carry small JSON payloads, so buffering is fine in practice.
  let body: Buffer | undefined;
  if (hasBody) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
    }
    body = Buffer.concat(chunks);
    headers.set("content-length", String(body.byteLength));
  }

  const fetch = options.fetch ?? globalThis.fetch;
  const response = await fetch(options.target, {
    method: req.method,
    headers,
    body,
    signal: options.signal
  } as any); // TODO: fetch API typings are mixed between envs, here we should have nodejs specific only

  res.writeHead(response.status, filterResponseHeaders(response.headers));

  if (!response.body) return res.end();

  await response.body.pipeTo(Writable.toWeb(res), { signal: options.signal });
}

// Node's fetch (undici) auto-decompresses gzip/br/deflate response bodies, so the
// bytes streamed to the client are already plaintext. We have to drop the original
// content-encoding header (otherwise the browser would try to decompress plaintext
// and fail with ERR_CONTENT_DECODING_FAILED) and content-length (the decompressed
// length differs from the upstream's compressed value).
const RESPONSE_HEADERS_TO_SKIP = new Set([...HEADERS_TO_SKIP, "content-encoding", "content-length"]);

function filterResponseHeaders(headers: Headers) {
  const result: Record<string, string | string[]> = {};

  for (const [k, v] of headers.entries()) {
    const lowKey = k.toLowerCase();
    if (RESPONSE_HEADERS_TO_SKIP.has(lowKey) || lowKey === "set-cookie") continue;
    result[k] = v;
  }

  const setCookies = headers.getSetCookie();
  if (setCookies.length > 0) {
    result["set-cookie"] = setCookies;
  }

  return result;
}
