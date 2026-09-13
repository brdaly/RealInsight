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
