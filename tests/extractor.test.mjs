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

// ---------------------------------------------------------------------------
// Negated facts. Listing copy says what a property lacks as readily as what it
// has, and the unqualified patterns previously read the negation as the fact:
// "no 3 beds" extracted beds 3, and "Status: Not active" extracted status
// "active" — the opposite of the source, shown to the visitor as drawn from it.
// ---------------------------------------------------------------------------

const FILLER = " Additional descriptive filler text so the listing clears the length checks.";

test("a negated number is not extracted as a fact", () => {
  const { facts, matches } = extractListingWithEvidence(`Charming home with no 3 beds.${FILLER}`);

  assert.equal(facts.beds, null);
  assert.equal(matches.beds, null);
});

test("a negated status is unknown rather than its own opposite", () => {
  const { facts } = extractListingWithEvidence(`Status: Not active.${FILLER}`);

  assert.equal(facts.status, "unknown");
});

test("a negation does not reach across a clause boundary", () => {
  const { facts } = extractListingWithEvidence(`There is no garage, 3 beds and 2 baths.${FILLER}`);

  assert.equal(facts.beds, 3, "the beds are in a different clause from the negation");
  assert.equal(facts.baths, 2);
});

test("a later affirmative mention is used when the first is negated", () => {
  const { facts, matches } = extractListingWithEvidence(
    `There are no 3 beds in the annexe; the main house has 4 beds.${FILLER}`,
  );

  assert.equal(facts.beds, 4);
  assert.match(matches.beds.quote, /4\s*beds/);
});

test("an ordinary listing is unaffected", () => {
  const { facts } = extractListingWithEvidence(`Lovely 3 beds 2 baths home, Status: Active.${FILLER}`);

  assert.deepEqual(
    { beds: facts.beds, baths: facts.baths, status: facts.status },
    { beds: 3, baths: 2, status: "active" },
  );
});

test("a non-breaking space is quoted verbatim, not normalised away", () => {
  // The extractor used to replace U+00A0 with a space before matching while the
  // submitted text kept it, so an "exact source span" quote was not exact.
  const source = `Spacious place with 3 beds throughout.${FILLER}`;

  const { facts, matches } = extractListingWithEvidence(source);

  assert.equal(facts.beds, 3, "U+00A0 is matched by \\s, so the fact is still found");
  assert.ok(matches.beds.quote.includes(" "), "the quote keeps the original character");
  assert.equal(
    source.slice(matches.beds.charStart, matches.beds.charEnd),
    matches.beds.quote,
    "the quote is the exact slice its span names",
  );
});
