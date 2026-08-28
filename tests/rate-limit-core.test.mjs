import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  CLAIM_EVALUATION_REQUEST_SQL,
  DAILY_USAGE_SQL,
  DELETE_STALE_REQUESTS_SQL,
  keyedHash,
  positiveInteger,
} from "../lib/rate-limit-core.mjs";

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE evaluation_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identity_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  return db;
}

function claim(db, { identityHash, now, stale, dailyLimit, cutoff, visitorLimit }) {
  return db.prepare(CLAIM_EVALUATION_REQUEST_SQL).get(
    identityHash,
    now,
    stale,
    dailyLimit,
    identityHash,
    cutoff,
    visitorLimit,
  );
}

test("rate-limit identity hashing is stable, keyed, and non-reversible by plain lookup", async () => {
  const first = await keyedHash("a-high-entropy-secret-for-testing", "session:visitor-123");
  const same = await keyedHash("a-high-entropy-secret-for-testing", "session:visitor-123");
  const differentIdentity = await keyedHash("a-high-entropy-secret-for-testing", "session:visitor-456");
  const differentSecret = await keyedHash("another-high-entropy-test-secret", "session:visitor-123");

  assert.equal(first, same);
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.notEqual(first, differentIdentity);
  assert.notEqual(first, differentSecret);
  assert.doesNotMatch(first, /visitor-123/);
  assert.equal(positiveInteger("25", 500), 25);
  assert.equal(positiveInteger("not-a-number", 500), 500);
  assert.equal(positiveInteger("0", 500), 500);
});

test("atomic claim SQL enforces visitor and global ceilings", () => {
  const db = database();
  const common = {
    now: "2026-08-27T12:00:00.000Z",
    stale: "2026-08-26T12:00:00.000Z",
    cutoff: "2026-08-27T11:00:00.000Z",
  };

  assert.ok(claim(db, { ...common, identityHash: "visitor-a", dailyLimit: 10, visitorLimit: 2 }));
  assert.ok(claim(db, { ...common, identityHash: "visitor-a", dailyLimit: 10, visitorLimit: 2 }));
  assert.equal(claim(db, { ...common, identityHash: "visitor-a", dailyLimit: 10, visitorLimit: 2 }), undefined);

  const globalDb = database();
  assert.ok(claim(globalDb, { ...common, identityHash: "visitor-a", dailyLimit: 1, visitorLimit: 20 }));
  assert.equal(claim(globalDb, { ...common, identityHash: "visitor-b", dailyLimit: 1, visitorLimit: 20 }), undefined);
  assert.equal(globalDb.prepare(DAILY_USAGE_SQL).get(common.stale).value, 1);
  db.close();
  globalDb.close();
});

test("stale abuse-control records are deleted without touching current records", () => {
  const db = database();
  db.exec(`INSERT INTO evaluation_requests (identity_hash, created_at) VALUES
    ('stale', '2026-08-25T00:00:00.000Z'),
    ('current', '2026-08-27T11:00:00.000Z')`);
  db.prepare(DELETE_STALE_REQUESTS_SQL).run("2026-08-26T12:00:00.000Z");
  assert.deepEqual(
    db.prepare("SELECT identity_hash FROM evaluation_requests ORDER BY identity_hash").all().map((row) => row.identity_hash),
    ["current"],
  );
  db.close();
});
