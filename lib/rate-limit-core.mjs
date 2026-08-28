export const EVALUATION_LIMIT = 20;
export const EVALUATION_WINDOW_MS = 60 * 60 * 1000;

/** @param {Request} request @param {string} visitorSessionId */
export function getRateLimitIdentity(request, visitorSessionId) {
  const forwarded = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || `session:${visitorSessionId}`;
}
