import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public demos are visibly synthetic and the UI has no unrelated photo or stale-market surface", async () => {
  const [demos, app, route] = await Promise.all([
    readFile(new URL("../lib/demo-listings.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/RealInsightApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/evaluate/route.ts", import.meta.url), "utf8"),
  ]);
  assert.equal([...demos.matchAll(/\n    id: "(clear-fit|verify-first|rule-conflict)"/g)].length, 3);
  assert.equal([...demos.matchAll(/Synthetic example — not a live listing/g)].length, 3);
  assert.doesNotMatch(`${demos}\n${app}`, /unsplash|school score|safety score|opening range|offer_range|active market dashboard/i);
  assert.doesNotMatch(route, /from "@\/db|\.insert\(|persistEvaluation|buyerProfiles|evaluations\./);
  assert.match(route, /persistence: "not_saved"/);
  assert.match(route, /validateEvaluationPayload/);
  assert.match(route, /addVisitorConfirmations/);
});
