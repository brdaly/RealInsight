import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("the public storage and AI boundaries are fail-closed and accurately disclosed", async () => {
  const [environment, route, rateCore, rateLimit, schema, database, runtimeSchema, migration, app, privacy] = await Promise.all([
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../app/api/evaluate/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/rate-limit-core.mjs", import.meta.url), "utf8"),
    readFile(new URL("../lib/rate-limit.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/runtime-schema.mjs", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0003_remove_legacy_storage.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/RealInsightApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../PRIVACY.md", import.meta.url), "utf8"),
  ]);

  assert.match(environment, /^REALINSIGHT_AI_ENABLED=false$/m);
  assert.match(route, /REALINSIGHT_AI_ENABLED\?\.trim\(\)\.toLowerCase\(\) === "true"/);
  assert.match(route, /readBoundedJson<EvaluatePayload>\(request, MAX_REQUEST_BYTES\)/);
  assert.match(rateCore, /crypto\.subtle\.sign\("HMAC"/);
  assert.match(rateCore, /INSERT INTO evaluation_requests/);
  assert.match(rateLimit, /CLAIM_EVALUATION_REQUEST_SQL/);
  assert.doesNotMatch(rateCore, /x-forwarded-for/i);

  assert.doesNotMatch(`${schema}\n${database}\n${runtimeSchema}`, /CREATE TABLE IF NOT EXISTS (buyer_profiles|listings|evaluations)|sqliteTable\("(buyer_profiles|listings|evaluations)"/);
  assert.equal([...migration.matchAll(/DROP TABLE IF EXISTS/g)].length, 3);
  assert.doesNotMatch(migration, /evaluation_requests/);

  for (const disclosure of [app, privacy]) {
    assert.match(disclosure, /30-day|30 days/);
    assert.match(disclosure, /buyer boundaries/);
    assert.match(disclosure, /confirmed facts/);
    assert.match(disclosure, /evidence/);
    assert.match(disclosure, /OpenAI/);
  }
});

test("repository publication controls are present and npm publishing remains blocked", async () => {
  const [packageJson, workflow, dependabot, security, license] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/dependabot.yml", import.meta.url), "utf8"),
    readFile(new URL("../SECURITY.md", import.meta.url), "utf8"),
    readFile(new URL("../LICENSE", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(packageJson);
  assert.equal(manifest.private, true);
  assert.equal(manifest.license, "UNLICENSED");
  assert.equal(manifest.packageManager, "pnpm@11.9.0");
  assert.match(workflow, /uses: actions\/checkout@[a-f0-9]{40}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /uses: pnpm\/setup@[a-f0-9]{40}/);
  assert.match(workflow, /runtime: node@22\.23\.2/);
  assert.match(workflow, /install: false/);
  assert.doesNotMatch(workflow, /pnpm\/action-setup|actions\/setup-node/);
  assert.match(workflow, /run: pnpm audit/);
  assert.match(workflow, /run: pnpm typecheck/);
  assert.match(dependabot, /package-ecosystem: npm/);
  assert.match(security, /Report a vulnerability/);
  assert.match(license, /All rights reserved/);

  const socialPreview = await stat(new URL("../public/social-preview.jpg", import.meta.url));
  assert.ok(socialPreview.size < 1_000_000, "GitHub social preview must stay under 1 MB");
});
