/**
 * Security response headers for every RealInsight response.
 *
 * These are applied in the Cloudflare Worker entry point rather than through
 * next.config.ts, because the Worker is the one layer guaranteed to run for
 * every request this deployment serves, including the image-optimization path.
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
 * WebSocket upgrade responses are returned untouched: their body and status
 * cannot be reconstructed.
 *
 * @param {Response} response
 * @returns {Response}
 */
export function withSecurityHeaders(response) {
  if (response.webSocket) return response;

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
