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
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS buyer_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        max_budget INTEGER NOT NULL,
        max_commute_minutes INTEGER NOT NULL,
        commute_anchor TEXT NOT NULL,
        must_haves TEXT NOT NULL,
        deal_breakers TEXT NOT NULL,
        amenities TEXT NOT NULL,
        weights TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS listings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        raw_text TEXT NOT NULL,
        source_url TEXT,
        extracted TEXT NOT NULL,
        photo_urls TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        listing_id INTEGER NOT NULL,
        buyer_profile_id INTEGER NOT NULL,
        visitor_session_id TEXT,
        photo_json TEXT,
        score_json TEXT NOT NULL,
        total_score INTEGER NOT NULL,
        passed_filters INTEGER NOT NULL,
        evaluation_mode TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS evaluation_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identity_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
    ]);

    const evaluationColumns = await env.DB.prepare("PRAGMA table_info(evaluations)").all();
    const columnNames = (evaluationColumns.results as Array<{ name?: unknown }>).map((column) => column.name);
    if (!columnNames.includes("visitor_session_id")) {
      await env.DB.prepare("ALTER TABLE evaluations ADD COLUMN visitor_session_id TEXT").run();
    }

    await env.DB.batch([
      env.DB.prepare("CREATE INDEX IF NOT EXISTS evaluations_listing_id_idx ON evaluations(listing_id)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS evaluations_visitor_session_id_idx ON evaluations(visitor_session_id)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS evaluation_requests_identity_created_idx ON evaluation_requests(identity_hash, created_at)"),
    ]);
  })();

  await schemaReady;
  return getDb();
}
