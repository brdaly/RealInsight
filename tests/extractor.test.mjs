import assert from "node:assert/strict";
import test from "node:test";
import { buildEvidenceLedger, addVisitorConfirmations } from "../lib/evidence-ledger.mjs";
import { extractListingWithEvidence } from "../lib/extractor.mjs";

const listing = `Synthetic example
$382,000 | 3 beds | 2 baths | 1,610 sq ft
Status: Active
Days on market: 41`;

test("extraction preserves exact quotes and character spans", () => {
  const extraction = extractListingWithEvidence(listing);
  assert.deepEqual(extraction.facts, {
    askingPrice: 382000,
    beds: 3,
    baths: 2,
    squareFeet: 1610,
    daysOnMarket: 41,
    status: "active",
  });
  for (const match of Object.values(extraction.matches)) {
    assert.ok(match);
    assert.equal(listing.slice(match.charStart, match.charEnd), match.quote);
  }
});

test("unknown facts become explicit evidence gaps", () => {
  const extraction = extractListingWithEvidence("A long fictional description with no structured price, status, bedroom, bathroom, size, or market-time facts.");
  const ledger = buildEvidenceLedger(extraction);
  assert.equal(ledger.length, 6);
  assert.ok(ledger.every((entry) => entry.status === "unknown"));
  assert.ok(ledger.every((entry) => entry.quote === null));
});

test("visitor corrections create separate confirmation evidence", () => {
  const extraction = extractListingWithEvidence(listing);
  const confirmed = { ...extraction.facts, askingPrice: 375000 };
  const ledger = addVisitorConfirmations(buildEvidenceLedger(extraction), extraction.facts, confirmed);
  const correction = ledger.find((entry) => entry.id === "confirm:askingPrice:0");
  assert.match(correction.claim, /Visitor corrected/);
  assert.match(correction.claim, /\$375,000/);
  assert.equal(correction.source, "visitor_confirmation");
});
