const patterns = {
  askingPrice: /(?:\$|USD\s*)\s*([0-9]{2,3}(?:,[0-9]{3})+|[0-9]{5,7})/i,
  squareFeet: /([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,5})\s*(?:sq\.?\s*ft\.?|square\s*feet)/i,
  daysOnMarket: /(?:days?\s+on\s+market|DOM)\s*[:\-]?\s*([0-9]{1,4})/i,
  beds: /([0-9]+(?:\.[05])?)\s*(?:bed(?:room)?s?|bd)\b/i,
  baths: /([0-9]+(?:\.[05])?)\s*(?:bath(?:room)?s?|ba)\b/i,
};

/**
 * Words that reverse the meaning of the phrase they introduce.
 *
 * Listing copy says what a property does not have as readily as what it does.
 * Without this, "no 3 beds" extracted `beds: 3` and "Status: Not active"
 * extracted `status: "active"` — the opposite of the source, presented to the
 * visitor as a fact drawn from it.
 */
const NEGATORS = /\b(?:no|not|never|without|excluding|lacks?|lacking|missing|n't)\b|n't\b/i;

/**
 * Whether a match is negated by the text leading up to it.
 *
 * Only the current clause counts. Scanning stops at the nearest punctuation or
 * line break before the match, so "no garage, 3 beds" still extracts 3 beds
 * while "no 3 beds" extracts nothing.
 *
 * @param {string} text full source text
 * @param {number} charStart index the match begins at
 * @returns {boolean}
 */
function isNegated(text, charStart) {
  const clauseStart = Math.max(
    ...[",", ".", ";", ":", "!", "?", "\n", "\u2014", "-"].map((mark) =>
      text.lastIndexOf(mark, charStart - 1),
    ),
  );
  return NEGATORS.test(text.slice(clauseStart + 1, charStart));
}

/**
 * First non-negated match for a pattern, or nothing.
 *
 * Later occurrences are considered when an earlier one is negated, so
 * "no 3 beds in the annexe; the house has 4 beds" reports 4.
 *
 * @param {string} text
 * @param {RegExp} pattern
 * @returns {RegExpExecArray | null}
 */
function firstAffirmativeMatch(text, pattern) {
  const scanner = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let match;
  while ((match = scanner.exec(text)) !== null) {
    if (match.index == null) break;
    if (!isNegated(text, match.index)) return match;
    if (scanner.lastIndex === match.index) scanner.lastIndex += 1;
  }
  return null;
}

function numericMatch(text, pattern) {
  const match = firstAffirmativeMatch(text, pattern);
  if (!match?.[1] || match.index == null) return { value: null, match: null };
  const value = Number(String(match[1]).replaceAll(",", ""));
  if (!Number.isFinite(value)) return { value: null, match: null };
  return {
    value,
    match: {
      quote: match[0],
      charStart: match.index,
      charEnd: match.index + match[0].length,
    },
  };
}

function statusMatch(text) {
  const candidates = [
    { value: "pending", pattern: /(?:status\s*:\s*)?(pending|under contract|contingent)\b/i },
    { value: "sold", pattern: /(?:status\s*:\s*)?(sold|closed)\b/i },
    { value: "active", pattern: /(?:status\s*:\s*)?(active|for sale|new listing)\b/i },
  ];
  for (const candidate of candidates) {
    const match = firstAffirmativeMatch(text, candidate.pattern);
    if (match?.index != null) {
      return {
        value: candidate.value,
        match: { quote: match[0], charStart: match.index, charEnd: match.index + match[0].length },
      };
    }
  }
  return { value: "unknown", match: null };
}

export function extractListingWithEvidence(rawText) {
  // Matched verbatim. `\s` in these patterns already matches U+00A0, so
  // normalising it away only made the recorded quote differ from the source
  // text it claims to be an exact span of.
  const text = String(rawText ?? "");
  const askingPrice = numericMatch(text, patterns.askingPrice);
  const beds = numericMatch(text, patterns.beds);
  const baths = numericMatch(text, patterns.baths);
  const squareFeet = numericMatch(text, patterns.squareFeet);
  const daysOnMarket = numericMatch(text, patterns.daysOnMarket);
  const status = statusMatch(text);
  return {
    facts: {
      askingPrice: askingPrice.value,
      beds: beds.value,
      baths: baths.value,
      squareFeet: squareFeet.value,
      daysOnMarket: daysOnMarket.value,
      status: status.value,
    },
    matches: {
      askingPrice: askingPrice.match,
      beds: beds.match,
      baths: baths.match,
      squareFeet: squareFeet.match,
      daysOnMarket: daysOnMarket.match,
      status: status.match,
    },
  };
}

export function extractListing(rawText) {
  return extractListingWithEvidence(rawText).facts;
}
