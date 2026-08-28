import assert from "node:assert/strict";
import test from "node:test";
import { addVisitorConfirmations, buildEvidenceLedger } from "../lib/evidence-ledger.mjs";
import { extractListingWithEvidence } from "../lib/extractor.mjs";
import { decideListing, findSupportedPhrase, SCORING_VERSION } from "../lib/scoring.mjs";

function evaluate(listingText, profile = { maxBudget: 425000, mustHave: "two-car garage", dealBreaker: "tenant occupied" }) {
  const extraction = extractListingWithEvidence(listingText);
  const ledger = addVisitorConfirmations(buildEvidenceLedger(extraction), extraction.facts, extraction.facts);
  return decideListing({ profile, listingText, facts: extraction.facts, evidenceLedger: ledger });
}

const clearFit = `Synthetic example
$382,000 | 3 beds | 2 baths | 1,610 sq ft
Status: Active
Days on market: 41
Brick home with a two-car garage and fenced yard.`;

test("identical confirmed inputs always produce identical V2 decisions", () => {
  const first = evaluate(clearFit);
  const second = evaluate(clearFit);
  assert.deepEqual(first, second);
  assert.equal(first.scoringVersion, SCORING_VERSION);
  assert.equal(first.decision, "tour_candidate");
  assert.equal(first.buyerFitScore, 85);
  assert.equal(first.evidenceCoverage, 100);
  assert.ok(!("offer_range" in first));
});

test("unknown status and sparse evidence yield verify-first, never synthetic merit", () => {
  const result = evaluate("Synthetic example with a two-car garage and enough general description to pass a listing-text intake threshold.");
  assert.equal(result.decision, "verify_first");
  assert.ok(result.evidenceCoverage < 70);
  assert.match(result.reasons.join(" "), /unconfirmed|incomplete/i);
});

test("budget and deal-breaker conflicts stop before recommendation", () => {
  const result = evaluate(`$468,000 | 4 beds | 3 baths | 2,100 sq ft
Status: Active
Days on market: 9
Cash only. Tenant occupied. Includes a two-car garage.`);
  assert.equal(result.decision, "stop");
  assert.equal(result.buyerFitScore, 0);
  assert.ok(result.hardStops.length >= 2);
});

test("negated deal-breaker wording does not create a false stop", () => {
  assert.equal(findSupportedPhrase("The property is not tenant occupied.", "tenant occupied"), null);
  const result = evaluate(`$380,000 | 3 beds | 2 baths | 1,500 sq ft
Status: Active
Days on market: 22
The property is not tenant occupied and includes a two-car garage.`);
  assert.notEqual(result.decision, "stop");
});
