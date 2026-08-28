export class PublicRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PublicRequestError";
    this.status = status;
  }
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;

  let suppliedOrigin: string;
  try {
    suppliedOrigin = new URL(origin).origin;
  } catch {
    throw new PublicRequestError("This request origin is invalid.", 403);
  }

  if (suppliedOrigin !== new URL(request.url).origin) {
    throw new PublicRequestError("Cross-site requests are not accepted.", 403);
  }
}

export async function readBoundedJson<T>(request: Request, maxBytes: number): Promise<T> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new PublicRequestError("Send this request as application/json.", 415);
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      throw new PublicRequestError("This request has an invalid size.", 400);
    }
    if (parsedLength > maxBytes) {
      throw new PublicRequestError("This request is too large.", 413);
    }
  }

  if (!request.body) {
    throw new PublicRequestError("This request has no JSON body.", 400);
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let totalBytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new PublicRequestError("This request is too large.", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    if (error instanceof PublicRequestError) throw error;
    throw new PublicRequestError("This request body is not valid UTF-8.", 400);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new PublicRequestError("This request body is not valid JSON.", 400);
  }
}
