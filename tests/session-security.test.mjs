import assert from "node:assert/strict";
import test from "node:test";
import { MAX_LISTING_TEXT_LENGTH, validateEvaluationPayload } from "../lib/evaluation-guard.ts";
import { getRateLimitIdentity } from "../lib/rate-limit-core.mjs";
import { getVisitorSession, visitorJson } from "../lib/visitor-session.ts";

const validPayload = {
  phase: "extract",
  profile: {
    maxBudget: 425000,
    mustHave: "garage",
    dealBreaker: "cash only",
  },
  listingText: "Active for sale at $389,000 with three bedrooms, two bathrooms, a garage, and enough detail for evaluation.",
};

test("anonymous visitor sessions are durable, HttpOnly, and secure on HTTPS", () => {
  const first = getVisitorSession(new Request("https://realinsight.example/api/shortlist"));
  assert.match(first.id, /^[A-Za-z0-9_-]{20,80}$/);
  assert.match(first.setCookie, /HttpOnly/);
  assert.match(first.setCookie, /SameSite=Lax/);
  assert.match(first.setCookie, /Secure/);

  const returning = getVisitorSession(new Request("https://realinsight.example/api/shortlist", {
    headers: { cookie: `ri_session=${first.id}` },
  }));
  assert.equal(returning.id, first.id);
  assert.equal(returning.setCookie, null);

  const replaced = getVisitorSession(new Request("https://realinsight.example/api/shortlist", {
    headers: { cookie: "ri_session=%E0%A4%A" },
  }));
  assert.notEqual(replaced.id, first.id);
  assert.ok(replaced.setCookie);

  const response = visitorJson(first, { items: [] });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("set-cookie"), /ri_session=/);
});

test("evaluation payload guard caps prompt-sized inputs", () => {
  assert.deepEqual(validateEvaluationPayload(validPayload), []);
  const oversized = validateEvaluationPayload({
    ...validPayload,
    listingText: "x".repeat(MAX_LISTING_TEXT_LENGTH + 1),
  });
  assert.ok(oversized.some((error) => /12,000 characters or fewer/.test(error)));
  const malformed = validateEvaluationPayload({
    ...validPayload,
    profile: { ...validPayload.profile, mustHave: "" },
  });
  assert.ok(malformed.some((error) => /essential feature/i.test(error)));

  const unconfirmed = validateEvaluationPayload({
    ...validPayload,
    phase: "evaluate",
    confirmedFacts: {
      askingPrice: 389000,
      beds: 3,
      baths: 2,
      squareFeet: 1600,
      daysOnMarket: 20,
      status: "active",
    },
  });
  assert.ok(unconfirmed.some((error) => /Confirm that you reviewed/i.test(error)));
  assert.ok(unconfirmed.some((error) => /data notice/i.test(error)));
});

test("rate-limit identity prefers Cloudflare IP and falls back to the visitor session", () => {
  assert.equal(getRateLimitIdentity(new Request("https://example.com", {
    headers: { "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.2" },
  }), "visitor-123"), "203.0.113.7");
  assert.equal(getRateLimitIdentity(new Request("https://example.com", {
    headers: { "x-forwarded-for": "198.51.100.2, 198.51.100.3" },
  }), "visitor-123"), "198.51.100.2");
  assert.equal(getRateLimitIdentity(new Request("http://localhost"), "visitor-123"), "session:visitor-123");
});
