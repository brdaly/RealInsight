import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships a Daly Ventures governed-agent workflow rather than the legacy ranking portal", async () => {
  const [layout, app, route, scoring, analysis, guard, packageJson] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/RealInsightApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/evaluate/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/scoring.mjs", import.meta.url), "utf8"),
    readFile(new URL("../lib/openai-analysis.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/evaluation-guard.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /Daly Ventures applied-AI demonstration/);
  assert.match(app, /Daly Ventures AI Lab · Governed prototype/);
  assert.match(app, /A listing is designed to sell/);
  assert.match(app, /Define three boundaries/);
  assert.match(app, /Review what the system extracted/);
  assert.match(app, /Reported in listing/);
  assert.match(app, /I reviewed these values/);
  assert.match(app, /Evidence coverage/);
  assert.match(app, /Stopped by your rules|decisionLabel/);
  assert.match(app, /Questions to verify next/);
  assert.match(app, /Agentic does not have to mean uncontrolled/);
  assert.match(app, /Listing text, buyer boundaries, confirmed facts, evidence, and decision briefs are not stored/);
  assert.match(scoring, /SCORING_VERSION = "ri-v2\.0"/);
  assert.match(scoring, /findSupportedPhrase/);
  assert.doesNotMatch(scoring, /offer_range|location_quality|value_vs_comps/);
  assert.match(analysis, /Versioned application code owns every score/);
  assert.match(analysis, /safety_identifier/);
  assert.match(analysis, /json_schema/);
  assert.doesNotMatch(analysis, /input_image|offer_range|total_score/);
  assert.match(guard, /phase\?: "extract" \| "evaluate"/);
  assert.match(guard, /factsConfirmed/);
  assert.match(route, /phase === "extract"/);
  assert.match(route, /decideListing/);
  assert.match(route, /analyzeWithOpenAI/);
  assert.match(route, /rateLimit\.allowed/);
  assert.match(packageJson, /"name": "realinsight"/);
  assert.doesNotMatch(`${layout}\n${app}\n${route}\n${scoring}\n${analysis}`, /codex-preview|site-creator-vinext-starter|What the inspector saw|Suggested opening range/);
});
