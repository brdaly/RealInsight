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

// ---------------------------------------------------------------------------
// The gap between a negator and the fact it governs is horizontal space, or a
// single hyphen with nothing around it.
//
// Allowing any whitespace let a negator at the end of a line govern the first
// fact on the next one, which is the same silent fact loss as the pipe case and
// lands on the commonest layout in listing copy: a spec sheet with one field
// per line. "HOA: No" answers the HOA, not the bedroom count below it.
// ---------------------------------------------------------------------------

test("a negator ending a line does not govern the next line", () => {
  const { facts } = extractListingWithEvidence(`HOA: No\n3 beds | 2 baths${FILLER}`);

  assert.equal(facts.beds, 3);
  assert.equal(facts.baths, 2);
});

test("a spec-sheet no does not suppress the field beneath it", () => {
  assert.equal(extractListingWithEvidence(`Pets allowed: No\n3 beds${FILLER}`).facts.beds, 3);
  assert.equal(extractListingWithEvidence(`Garage: No\nStatus: Active${FILLER}`).facts.status, "active");
  assert.equal(extractListingWithEvidence(`Waterfront: No\n1,610 sq ft${FILLER}`).facts.squareFeet, 1610);
  assert.equal(extractListingWithEvidence(`Rented: Never\n4 beds${FILLER}`).facts.beds, 4);
});

test("a spaced hyphen separates items rather than binding the negator", () => {
  // Only an intra-word hyphen binds, which is what lets "not-active" negate
  // while "no - 3 beds" keeps the bedrooms.
  const { facts } = extractListingWithEvidence(`HOA: no - 3 beds - 2 baths${FILLER}`);

  assert.equal(facts.beds, 3);
  assert.equal(facts.baths, 2);
});

test("an ordinary hyphenated adjective is not read as a negator", () => {
  const { facts } = extractListingWithEvidence(`Mid-century 3 beds 2 baths, Status: Active.${FILLER}`);

  assert.equal(facts.beds, 3);
  assert.equal(facts.status, "active");
});

// A negator reaches across an ordinary predicate or adverb, which anchoring the
// pattern on the match did not allow. "does not have 3 beds" reported beds: 3
// and "Status: not currently active" reported "active" — the same inversion the
// guard exists to prevent, on phrasing at least as common as the spec-sheet
// layout the anchoring was introduced for.
test("a negator reaches across an intervening predicate", () => {
  assert.equal(extractListingWithEvidence(`This home does not have 3 beds.${FILLER}`).facts.beds, null);
  assert.equal(extractListingWithEvidence(`The listing does not include 1,610 sq ft${FILLER}`).facts.squareFeet, null);
  assert.equal(extractListingWithEvidence(`It doesn't offer 2 baths${FILLER}`).facts.baths, null);
});

test("a negator reaches across an intervening adverb", () => {
  assert.equal(extractListingWithEvidence(`Status: not currently active${FILLER}`).facts.status, "unknown");
  assert.equal(extractListingWithEvidence(`Status: no longer actively for sale${FILLER}`).facts.status, "unknown");
});

test("cannot is a negator", () => {
  assert.equal(extractListingWithEvidence(`The annexe cannot hold 3 beds${FILLER}`).facts.beds, null);
});

test("a negator does not reach across more than a few words", () => {
  // The backstop for prose carrying neither a boundary nor a conjunction. It
  // fails towards reporting nothing, never towards reporting the opposite.
  const { facts } = extractListingWithEvidence(
    `No HOA here as the previous owners finally settled it 3 beds${FILLER}`,
  );

  assert.equal(facts.beds, 3);
});

test("the nearest negator governs, not the first one in the window", () => {
  // "never" governs the garage; the phrase before the beds is affirmative.
  const { facts } = extractListingWithEvidence(`Never a garage, but the house has 3 beds${FILLER}`);

  assert.equal(facts.beds, 3);
});
