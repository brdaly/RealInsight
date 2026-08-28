/** Minimal platform declarations used by the local type-checker.
 * The deployment runtime supplies the concrete Cloudflare Worker bindings.
 */
interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

// Drizzle consumes the runtime D1 client structurally; Cloudflare injects it at deployment.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D1Database = any;

declare module "cloudflare:workers" {
  export const env: { DB: D1Database };
}
