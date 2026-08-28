import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the language model has finding-and-question authority only", async () => {
  const analysis = await readFile(new URL("../lib/openai-analysis.ts", import.meta.url), "utf8");
  assert.match(analysis, /Never assign a score, change a decision, estimate value, suggest an offer/);
  assert.match(analysis, /evidenceIds/);
  assert.match(analysis, /validateEvidenceReferences/);
  assert.match(analysis, /strict: true/);
  assert.match(analysis, /safetyIdentifier/);
  assert.doesNotMatch(analysis, /buyerFitScore|evidenceCoverage|decisionLabel|hardStops/);
});
