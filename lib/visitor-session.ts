const COOKIE_NAME = "ri_session";
const SESSION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const THIRTY_DAYS = 60 * 60 * 24 * 30;

function cookieValue(cookieHeader: string | null, name: string) {
  for (const part of cookieHeader?.split(";") ?? []) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) {
      try {
        return decodeURIComponent(value.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export type VisitorSession = {
  id: string;
  setCookie: string | null;
};

export function getVisitorSession(request: Request): VisitorSession {
  const existing = cookieValue(request.headers.get("cookie"), COOKIE_NAME);
  if (existing && SESSION_PATTERN.test(existing)) return { id: existing, setCookie: null };

  const id = crypto.randomUUID();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return {
    id,
    setCookie: `${COOKIE_NAME}=${encodeURIComponent(id)}; Path=/; Max-Age=${THIRTY_DAYS}; HttpOnly; SameSite=Lax${secure}`,
  };
}

export function visitorJson(
  visitor: VisitorSession,
  body: unknown,
  init: ResponseInit = {},
) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  if (visitor.setCookie) headers.set("Set-Cookie", visitor.setCookie);
  return Response.json(body, { ...init, headers });
}
