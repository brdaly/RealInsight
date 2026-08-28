import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

let schemaReady: Promise<void> | null = null;

export async function getReadyDb() {
  if (!env.DB) {
    return getDb();
  }

  schemaReady ??= (async () => {
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS evaluation_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identity_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS evaluation_requests_identity_created_idx ON evaluation_requests(identity_hash, created_at)"),
    ]);
  })();

  await schemaReady;
  return getDb();
}
