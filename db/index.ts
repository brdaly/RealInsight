import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import {
  createSchemaReadiness,
  EVALUATION_REQUESTS_SCHEMA_SQL,
} from "./runtime-schema.mjs";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

const ensureSchemaReady = createSchemaReadiness(async () => {
  if (!env.DB) {
    throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  }

  await env.DB.batch(
    EVALUATION_REQUESTS_SCHEMA_SQL.map((statement) => env.DB.prepare(statement))
  );
});

export async function getReadyDb() {
  if (!env.DB) {
    return getDb();
  }

  await ensureSchemaReady();
  return getDb();
}
