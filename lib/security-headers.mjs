/**
 * Security response headers for the responses the Worker serves.
 *
 * These are applied in the Cloudflare Worker entry point rather than through
 * next.config.ts, because the Worker is the layer that runs for every document,
 * API route and the image-optimization path.
 *
 * It is not every response the site serves, and static files are the gap. The
 * generated Wrangler config sets `assets.directory` without
 * `run_worker_first`, so under Cloudflare's default asset routing every static
 * file, `public/` and `/_next/static/` alike, is served before the Worker is
 * invoked and carries none of these headers.
 *
 * Note that `vinext start` does NOT reproduce this: it routes `public/` files
 * through the Worker, so a local check shows headers on `/og.png` that the
 * deployment does not send. Verify header coverage against
 * `wrangler dev --config dist/server/wrangler.json`, not the local server.
 *
 * Closing the gap means invoking the Worker on every asset request, which is a
 * cost decision rather than an oversight.
 *
 * The Content-Security-Policy here deliberately omits script-src and
 * style-src. The App Router emits inline bootstrap scripts and inline styles,
 * so restricting those two directives safely requires per-request nonces
 * threaded through the document. The directives that are set cannot break
 * script or style loading, and they close the framing, base-tag and
 * form-hijacking vectors outright. Adding a nonce strategy is tracked
 * separately; a policy that has to be relaxed with 'unsafe-inline' would
 * advertise protection it does not provide.
 */
export const SECURITY_HEADERS = Object.freeze({
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy":
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  "Permissions-Policy":
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
});

/**
 * Return a response carrying the security headers.
 *
 * A header already set upstream wins, so a route that needs a narrower policy
 * can set its own without being overwritten here.
 *
 * Headers are set on the response in place wherever that is allowed, and the
 * response is never rebuilt around its own body when it can be avoided.
 * Rebuilding is what broke static assets: `new Response(response.body, ...)`
 * detaches a stream-backed body from the response that owns it, and under the
 * Node production server (`pnpm start`) that stream then closes before it is
 * read. `/og.png` and `/social-preview.jpg` returned 200 with zero bytes.
 *
 * Where header mutation is refused, as on a `fetch()` response in workerd,
 * rebuilding is the documented way to add headers and does not detach the body
 * on that runtime, so it stays as the fallback.
 *
 * WebSocket upgrade responses are returned untouched: their body and status
 * cannot be reconstructed.
 *
 * @param {Response} response
 * @returns {Response}
 */
export function withSecurityHeaders(response) {
  if (response.webSocket) return response;

  try {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      if (!response.headers.has(name)) response.headers.set(name, value);
    }
    return response;
  } catch {
    // Immutable headers: rebuild, which is correct on the runtimes that refuse
    // mutation. Reaching here with a stream-backed body is the case the comment
    // above describes, so keep this path for immutable responses only.
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      if (!headers.has(name)) headers.set(name, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}
