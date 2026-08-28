export const EVALUATION_LIMIT = 20;
export const EVALUATION_WINDOW_MS = 60 * 60 * 1000;
export const DELETE_STALE_REQUESTS_SQL = "DELETE FROM evaluation_requests WHERE created_at < ?";
export const DAILY_USAGE_SQL = "SELECT COUNT(*) AS value FROM evaluation_requests WHERE created_at >= ?";
export const CLAIM_EVALUATION_REQUEST_SQL = `
  INSERT INTO evaluation_requests (identity_hash, created_at)
  SELECT ?, ?
  WHERE (SELECT COUNT(*) FROM evaluation_requests WHERE created_at >= ?) < ?
    AND (SELECT COUNT(*) FROM evaluation_requests WHERE identity_hash = ? AND created_at >= ?) < ?
  RETURNING id
`;

/** @param {string | undefined} value @param {number} fallback */
export function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** @param {string} secret @param {string} value */
export async function keyedHash(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** @param {Request} request @param {string} visitorSessionId */
export function getRateLimitIdentity(request, visitorSessionId) {
  const cloudflareAddress = request.headers.get("cf-connecting-ip")?.trim();
  return cloudflareAddress || `session:${visitorSessionId}`;
}
