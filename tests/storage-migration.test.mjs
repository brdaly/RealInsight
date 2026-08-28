import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

function statements(sql) {
  return sql.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean);
}

async function applyMigration(database, relativePath) {
  const sql = await readFile(new URL(relativePath, import.meta.url), "utf8");
  for (const statement of statements(sql)) database.exec(statement);
}

function objectNames(database, type) {
  return database.prepare("SELECT name FROM sqlite_master WHERE type = ? ORDER BY name").all(type).map((row) => row.name);
}

test("legacy storage migration preserves only abuse-control storage and its index", async () => {
  const database = new DatabaseSync(":memory:");
  await applyMigration(database, "../drizzle/0000_organic_gamora.sql");
  await applyMigration(database, "../drizzle/0001_slimy_menace.sql");
  await applyMigration(database, "../drizzle/0002_fixed_red_ghost.sql");
  database.exec("INSERT INTO evaluation_requests (identity_hash, created_at) VALUES ('test-hash', '2026-08-27T00:00:00.000Z')");

  await applyMigration(database, "../drizzle/0003_remove_legacy_storage.sql");

  assert.deepEqual(objectNames(database, "table"), ["evaluation_requests", "sqlite_sequence"]);
  assert.ok(objectNames(database, "index").includes("evaluation_requests_identity_created_idx"));
  assert.deepEqual({ ...database.prepare("SELECT identity_hash, created_at FROM evaluation_requests").get() }, {
    identity_hash: "test-hash",
    created_at: "2026-08-27T00:00:00.000Z",
  });
  database.close();
});

test("legacy storage cleanup is idempotent and tolerates a partial old schema", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec("CREATE TABLE evaluation_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, identity_hash TEXT NOT NULL, created_at TEXT NOT NULL)");
  database.exec("CREATE TABLE listings (id INTEGER PRIMARY KEY AUTOINCREMENT, raw_text TEXT NOT NULL)");

  await applyMigration(database, "../drizzle/0003_remove_legacy_storage.sql");
  await applyMigration(database, "../drizzle/0003_remove_legacy_storage.sql");

  assert.deepEqual(objectNames(database, "table"), ["evaluation_requests", "sqlite_sequence"]);
  database.close();
});
