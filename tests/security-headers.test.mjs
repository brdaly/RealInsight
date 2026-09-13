import assert from "node:assert/strict";
import test from "node:test";

import { SECURITY_HEADERS, withSecurityHeaders } from "../lib/security-headers.mjs";

test("every declared security header is applied", () => {
  const out = withSecurityHeaders(new Response("body"));
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    assert.equal(out.headers.get(name), value, `missing or wrong ${name}`);
  }
});

test("the policy forbids framing, foreign base tags and foreign form posts", () => {
  const csp = withSecurityHeaders(new Response("body")).headers.get("content-security-policy");
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /form-action 'self'/);
  assert.match(csp, /object-src 'none'/);
});

test("the policy does not claim script or style protection it cannot enforce", () => {
  const csp = withSecurityHeaders(new Response("body")).headers.get("content-security-policy");
  assert.ok(!csp.includes("unsafe-inline"), "must never ship unsafe-inline");
  assert.ok(!csp.includes("script-src"), "script-src needs nonces before it is claimed");
});

test("status, body and upstream headers survive", async () => {
  const upstream = new Response("payload", {
    status: 201,
    statusText: "Created",
    headers: { "Content-Type": "text/plain", "Set-Cookie": "a=b" },
  });
  const out = withSecurityHeaders(upstream);
  assert.equal(out.status, 201);
  assert.equal(out.headers.get("content-type"), "text/plain");
  assert.equal(out.headers.get("set-cookie"), "a=b");
  assert.equal(await out.text(), "payload");
});

test("a header set upstream is not overwritten", () => {
  const upstream = new Response("body", {
    headers: { "Referrer-Policy": "no-referrer" },
  });
  assert.equal(withSecurityHeaders(upstream).headers.get("referrer-policy"), "no-referrer");
});

test("null-body statuses are handled without throwing", () => {
  for (const status of [204, 304]) {
    const out = withSecurityHeaders(new Response(null, { status }));
    assert.equal(out.status, status);
    assert.equal(out.headers.get("x-content-type-options"), "nosniff");
  }
});

test("websocket upgrade responses pass through untouched", () => {
  const upgrade = new Response(null, { status: 200 });
  Object.defineProperty(upgrade, "webSocket", { value: {}, configurable: true });
  assert.equal(withSecurityHeaders(upgrade), upgrade);
});

// ---------------------------------------------------------------------------
// Regression: a stream-backed body must survive the header pass.
//
// The first version rebuilt every response as `new Response(response.body, …)`.
// That detaches a stream-backed body from the response that owns it, and under
// `pnpm start` the stream then closed before it was read: `/og.png` and
// `/social-preview.jpg` served 200 with zero bytes. These assert on the bytes
// that come back, which a string-bodied fixture cannot catch.
// ---------------------------------------------------------------------------

function streamedResponse(chunks, init = {}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, init);
}

test("a stream-backed body is delivered whole", async () => {
  const original = streamedResponse(["binary-", "asset-", "payload"], {
    headers: { "content-type": "image/png" },
  });

  const guarded = withSecurityHeaders(original);

  assert.equal(await guarded.text(), "binary-asset-payload");
  assert.equal(guarded.headers.get("content-type"), "image/png");
  assert.equal(guarded.headers.get("X-Content-Type-Options"), "nosniff");
});

test("a multi-chunk stream is not truncated at the first chunk", async () => {
  const chunks = Array.from({ length: 64 }, (_, index) => `chunk-${index};`);

  const guarded = withSecurityHeaders(streamedResponse(chunks));

  assert.equal(await guarded.text(), chunks.join(""));
});

test("a stream-backed body survives even when headers cannot be mutated", async () => {
  const original = streamedResponse(["immutable-", "stream"]);
  // Model a runtime that refuses header mutation, as workerd does for a
  // fetch() response, so the rebuild fallback is exercised rather than skipped.
  Object.defineProperty(original, "headers", {
    value: new Proxy(original.headers, {
      get(target, property) {
        if (property === "set") {
          return () => {
            throw new TypeError("immutable headers");
          };
        }
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  });

  const guarded = withSecurityHeaders(original);

  assert.equal(guarded.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(await guarded.text(), "immutable-stream");
});

test("the returned response carries every declared header on a streamed body", async () => {
  const guarded = withSecurityHeaders(streamedResponse(["x"]));

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    assert.equal(guarded.headers.get(name), value, `missing ${name}`);
  }
});
