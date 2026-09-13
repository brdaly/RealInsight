/**
 * Behavioural tests for the public evaluate endpoint.
 *
 * The rest of the suite asserts that guard *source text* matches a regex. Those
 * greps are a useful second net, but they cannot tell a guard from its
 * inversion: a change that keeps the literal text and flips its meaning passes
 * them. These call the exported `POST` handler and assert on what comes back.
 *
 * `tests/support/loader.mjs` resolves the route's `@/` aliases and stubs
 * `cloudflare:workers`, so this exercises the same module the application ships.
 */
import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { POST } from "@/app/api/evaluate/route.ts";
import { env, resetEnv } from "./support/cloudflare-workers.mjs";

const ORIGIN = "https://realinsight.test";

const PROFILE = {
  maxBudget: 400_000,
  mustHave: "Home office",
  dealBreaker: "Busy road",
};

const CONFIRMED_FACTS = {
  askingPrice: 382_000,
  beds: 3,
  baths: 2,
  squareFeet: 1_610,
  daysOnMarket: 41,
  status: "active",
};

function post(body, { headers = {}, origin = ORIGIN } = {}) {
  const serialized = JSON.stringify(body);
  return new Request(`${ORIGIN}/api/evaluate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      ...headers,
    },
    body: serialized,
  });
}

function evaluatePayload(overrides = {}) {
  return {
    phase: "evaluate",
    profile: PROFILE,
    demoId: "clear-fit",
    confirmedFacts: CONFIRMED_FACTS,
    factsConfirmed: true,
    aiConsent: true,
    ...overrides,
  };
}

const originalEnv = {};
const MANAGED_KEYS = [
  "OPENAI_API_KEY",
  "REALINSIGHT_AI_ENABLED",
  "REALINSIGHT_RATE_LIMIT_HASH_SECRET",
];

beforeEach(() => {
  for (const key of MANAGED_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
  resetEnv();
});

afterEach(() => {
  for (const key of MANAGED_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  resetEnv();
});

test("the confirmation gate rejects an evaluation the visitor never confirmed", async () => {
  const response = await POST(post(evaluatePayload({ factsConfirmed: false })));

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /Confirm that you reviewed the facts/);
  assert.equal(body.result, undefined);
});

test("the consent gate rejects an evaluation without the demo-data acknowledgement", async () => {
  const response = await POST(post(evaluatePayload({ aiConsent: false })));

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Acknowledge the demo data notice/);
});

test("an evaluation without confirmed facts at all is rejected, not defaulted", async () => {
  const payload = evaluatePayload();
  delete payload.confirmedFacts;

  const response = await POST(post(payload));

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Review the extracted facts/);
});

test("the extract phase returns a draft and never a decision", async () => {
  const response = await POST(post({ phase: "extract", profile: PROFILE, demoId: "clear-fit" }));

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.result, undefined, "extract must not decide");
  assert.equal(body.persistence, "not_saved");
  assert.ok(Array.isArray(body.draft.evidenceLedger) && body.draft.evidenceLedger.length > 0);
  assert.equal(body.draft.provenance.kind, "synthetic_demo");
});

test("with the AI kill switch off the decision still completes, deterministically", async () => {
  process.env.OPENAI_API_KEY = "sk-test-key";
  process.env.REALINSIGHT_AI_ENABLED = "false";

  const response = await POST(post(evaluatePayload()));

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.result.analysisMode, "deterministic-demo");
  assert.match(body.result.analysisNotice, /kill switch/);
  assert.equal(body.persistence, "not_saved");
  assert.ok(body.result.questions.length > 0, "the deterministic path still asks questions");
});

test("the kill switch is the literal string 'true', not any truthy value", async () => {
  process.env.OPENAI_API_KEY = "sk-test-key";
  process.env.REALINSIGHT_AI_ENABLED = "1";

  const body = await (await POST(post(evaluatePayload()))).json();

  assert.equal(body.result.analysisMode, "deterministic-demo");
});

test("a missing API key keeps the AI path closed even when the switch is on", async () => {
  process.env.REALINSIGHT_AI_ENABLED = "true";

  const body = await (await POST(post(evaluatePayload()))).json();

  assert.equal(body.result.analysisMode, "deterministic-demo");
});

test("a cross-site request is refused before the payload is read", async () => {
  const response = await POST(post(evaluatePayload(), { origin: "https://attacker.example" }));

  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /Cross-site requests are not accepted/);
});

test("a non-JSON content type is refused", async () => {
  const response = await POST(post(evaluatePayload(), { headers: { "content-type": "text/plain" } }));

  assert.equal(response.status, 415);
});

test("an over-declared body length is refused before the body is read", async () => {
  const response = await POST(post(evaluatePayload(), { headers: { "content-length": "999999" } }));

  assert.equal(response.status, 413);
});

test("every response is no-store and carries a visitor session cookie", async () => {
  const response = await POST(post(evaluatePayload({ factsConfirmed: false })));

  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("set-cookie") ?? "", /ri_session=[^;]+; Path=\/;.*HttpOnly/);
});

test("an unknown demo id is rejected rather than falling back to a listing", async () => {
  const response = await POST(post(evaluatePayload({ demoId: "no-such-demo" })));

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Choose a valid safe demo/);
});

// ---------------------------------------------------------------------------
// The live-AI path. The model may only supply questions; it may never reach the
// decision. These drive it with a stubbed fetch and a stubbed D1 binding.
// ---------------------------------------------------------------------------

function allowingRateLimit() {
  const prepare = (sql) => ({
    bind: () => ({
      run: async () => ({ success: true }),
      first: async () => (sql.includes("INSERT") ? { id: 1 } : { value: 0 }),
    }),
    run: async () => ({ success: true }),
    first: async () => null,
  });
  return { prepare, batch: async () => [] };
}

function denyingRateLimit() {
  const prepare = (sql) => ({
    bind: () => ({
      run: async () => ({ success: true }),
      // No row inserted means the claim was refused.
      first: async () => (sql.includes("INSERT") ? null : { value: 0 }),
    }),
    run: async () => ({ success: true }),
    first: async () => null,
  });
  return { prepare, batch: async () => [] };
}

function modelResponding(payload) {
  return async () =>
    new Response(
      JSON.stringify({
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(payload) }] }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
}

async function withStubbedFetch(stub, run) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

test("model-drafted questions are used, and the decision still comes from the rules", async () => {
  process.env.OPENAI_API_KEY = "sk-test-key";
  process.env.REALINSIGHT_AI_ENABLED = "true";
  env.DB = allowingRateLimit();

  const deterministic = await (async () => {
    process.env.REALINSIGHT_AI_ENABLED = "false";
    const body = await (await POST(post(evaluatePayload()))).json();
    process.env.REALINSIGHT_AI_ENABLED = "true";
    return body.result;
  })();

  const body = await withStubbedFetch(
    modelResponding({ questions: [{ question: "What is the roof age?", evidenceIds: [] }] }),
    async () => (await POST(post(evaluatePayload()))).json(),
  );

  assert.equal(body.result.analysisMode, "ai-assisted");
  assert.ok(
    body.result.questions.some((item) => item.question === "What is the roof age?"),
    "the model's question should appear",
  );

  // The parts the model is never allowed to touch must be byte-identical.
  assert.equal(body.result.decision, deterministic.decision);
  assert.equal(body.result.score, deterministic.score);
  assert.deepEqual(body.result.evidenceLedger, deterministic.evidenceLedger);
});

test("a model citing an evidence id that does not exist has it stripped", async () => {
  process.env.OPENAI_API_KEY = "sk-test-key";
  process.env.REALINSIGHT_AI_ENABLED = "true";
  env.DB = allowingRateLimit();

  const body = await withStubbedFetch(
    modelResponding({
      questions: [{ question: "Why is this priced this way?", evidenceIds: ["ev-does-not-exist"] }],
    }),
    async () => (await POST(post(evaluatePayload()))).json(),
  );

  const injected = body.result.questions.find((item) => item.question === "Why is this priced this way?");
  assert.ok(injected, "the question itself survives");
  assert.ok(
    !(injected.evidenceIds ?? []).includes("ev-does-not-exist"),
    "a fabricated evidence id must not reach the response",
  );
});

test("a model failure degrades to the deterministic result, not a 500", async () => {
  process.env.OPENAI_API_KEY = "sk-test-key";
  process.env.REALINSIGHT_AI_ENABLED = "true";
  env.DB = allowingRateLimit();

  const response = await withStubbedFetch(
    async () => new Response("upstream exploded", { status: 500 }),
    async () => POST(post(evaluatePayload())),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.result.analysisMode, "deterministic-demo");
  assert.match(body.result.analysisNotice, /Live AI was unavailable/);
});

test("a refused rate-limit claim still returns the deterministic decision", async () => {
  process.env.OPENAI_API_KEY = "sk-test-key";
  process.env.REALINSIGHT_AI_ENABLED = "true";
  env.DB = denyingRateLimit();

  let modelCalled = false;
  const body = await withStubbedFetch(
    async () => {
      modelCalled = true;
      return new Response("{}", { status: 200 });
    },
    async () => (await POST(post(evaluatePayload()))).json(),
  );

  assert.equal(modelCalled, false, "a refused claim must not reach the model");
  assert.equal(body.result.analysisMode, "deterministic-demo");
  assert.match(body.result.analysisNotice, /rate limit|safety ceiling/);
});

test("nothing on the evaluate path is persisted", async () => {
  process.env.OPENAI_API_KEY = "sk-test-key";
  process.env.REALINSIGHT_AI_ENABLED = "true";
  const statements = [];
  env.DB = {
    prepare(sql) {
      statements.push(sql);
      return allowingRateLimit().prepare(sql);
    },
    batch: async () => [],
  };

  const body = await withStubbedFetch(
    modelResponding({ questions: [{ question: "What is the roof age?", evidenceIds: [] }] }),
    async () => (await POST(post(evaluatePayload()))).json(),
  );

  assert.equal(body.persistence, "not_saved");
  for (const sql of statements) {
    assert.doesNotMatch(
      sql,
      /INSERT INTO (?!evaluation_requests)/i,
      `unexpected write: ${sql}`,
    );
  }
});
