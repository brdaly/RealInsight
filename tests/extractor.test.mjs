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

// ---------------------------------------------------------------------------
// Negation has to govern the phrase it negates, not merely appear before it.
//
// The first version of this guard scanned the whole clause for a negator
// anywhere in it. That inverted its own purpose on the commonest listing idiom
// there is: in "No HOA | 3 beds | 2 baths" the "No" governs the HOA, and
// treating it as governing the rest of the line discarded two facts the text
// plainly supports. Losing real facts is the worse failure, because listings
// say "No HOA" far more often than they say "no 3 beds".
// ---------------------------------------------------------------------------

test("a negator governing a different subject does not suppress later facts", () => {
  const { facts } = extractListingWithEvidence(`No HOA | 3 beds | 2 baths${FILLER}`);

  assert.equal(facts.beds, 3);
  assert.equal(facts.baths, 2);
});

test("a negator joined by a conjunction does not reach the second clause", () => {
  const { facts } = extractListingWithEvidence(`No HOA and the home has 3 beds.${FILLER}`);

  assert.equal(facts.beds, 3);
});

test("a hyphenated negator still negates", () => {
  // "-" is a separator inside a word, not a clause boundary. Treating it as a
  // boundary let "not-active" through as status "active", the exact inversion
  // this guard exists to prevent.
  assert.equal(extractListingWithEvidence(`Status: not-active.${FILLER}`).facts.status, "unknown");
  assert.equal(extractListingWithEvidence(`Status: no-longer active.${FILLER}`).facts.status, "unknown");
});

test("a negator separated from the match by a modifier still negates", () => {
  assert.equal(extractListingWithEvidence(`Home without 3 beds listed.${FILLER}`).facts.beds, null);
  assert.equal(extractListingWithEvidence(`There are no more 3 beds here.${FILLER}`).facts.beds, null);
});

test("a contraction negator is recognised", () => {
  assert.equal(extractListingWithEvidence(`Status: isn't active right now.${FILLER}`).facts.status, "unknown");
});
