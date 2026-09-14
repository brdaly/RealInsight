const patterns = {
  askingPrice: /(?:\$|USD\s*)\s*([0-9]{2,3}(?:,[0-9]{3})+|[0-9]{5,7})/i,
  squareFeet: /([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,5})\s*(?:sq\.?\s*ft\.?|square\s*feet)/i,
  daysOnMarket: /(?:days?\s+on\s+market|DOM)\s*[:\-]?\s*([0-9]{1,4})/i,
  beds: /([0-9]+(?:\.[05])?)\s*(?:bed(?:room)?s?|bd)\b/i,
  baths: /([0-9]+(?:\.[05])?)\s*(?:bath(?:room)?s?|ba)\b/i,
};

/**
 * Negation that GOVERNS the phrase immediately after it.
 *
 * A negator governs a match when it is the nearest one before it and nothing
 * between them changes what is being spoken about. Two earlier attempts each
 * failed in one direction, and both failures are inversions of the source:
 *
 *   scanning the whole clause   "No HOA | 3 beds | 2 baths" lost both facts,
 *                               because the "No" answers the HOA.
 *   anchoring on the match      "does not have 3 beds" reported beds: 3, and
 *                               "Status: not currently active" reported
 *                               "active", because one ordinary predicate or
 *                               adverb between the negator and the phrase was
 *                               enough to hide the negator.
 *
 * So the gap is judged rather than forbidden. It may carry a few words, but
 * not a boundary between items and not a coordinating conjunction, because
 * either one starts something new for the negator to no longer govern:
 *
 *   "No HOA and the home has 3 beds"   "and" opens a new predicate -> beds 3
 *   "no garage, 3 beds"                a comma separates items     -> beds 3
 *   "HOA: No\n3 beds"                  a line break ends the field  -> beds 3
 *   "HOA: no - 3 beds"                 a spaced dash separates      -> beds 3
 *   "does not have 3 beds"             a verb of having             -> null
 *   "Status: not-active"               an intra-word hyphen binds   -> unknown
 *   "Don't miss this charming 3 bed"   "miss" is not a verb of having -> beds 3
 *
 * The word limit is the backstop for prose that carries neither signal, and it
 * fails towards reporting nothing rather than towards reporting the opposite
 * of the source, which is the direction this repository fails in everywhere.
 */
const NEGATOR =
  /(?:^|[^\p{L}\p{N}])(?:no|nor|not|none|neither|never|cannot|without|excluding|lacks?|lacking|missing|\p{L}+n['\u2019]t)(?=[^\p{L}\p{N}]|$)/giu;

/** Starts something new, so a negator before it does not reach past it. */
const ITEM_BOUNDARY = /[|,;:.!?\r\n/•·]|[^\S\r\n][-\u2013\u2014]+[^\S\r\n]/u;

/** Joins a second predicate, which the negator does not carry into. */
const CONJUNCTION = /^(?:and|or|but|plus|with|also|while|though|although|however)$/iu;

/**
 * Words a negator carries across to reach the phrase it governs.
 *
 * Counting words was not enough. "Don't miss this charming 3 bed home" and
 * "Never lived in 3 bed home" put three words and two words respectively
 * between the negator and the fact, and both are affirmative: the negator
 * governs the reader or the occupancy, never the bedroom count. A short gap is
 * proximity, not scope.
 *
 * What the true cases share is the KIND of word in the gap: an auxiliary, a
 * determiner, an adverb, or a verb of having or including. "does not have",
 * "doesn't offer", "cannot hold", "not currently". A verb outside that set is
 * doing something else with the negation, so the fact after it stands.
 *
 * The list is deliberately generous for the verbs listing copy uses, because an
 * unrecognised one now reports the fact rather than suppressing it, and that is
 * the inversion direction. The rule it replaces failed the safer way but did so
 * on far commoner copy, which is the trade being made here.
 */
const LINKING = new Set([
  "a", "an", "the", "any", "all", "this", "that", "these", "those", "its", "their", "our", "my", "his", "her", "much", "many",
  "longer", "more", "currently", "presently", "actually", "really", "yet", "even", "quite", "truly", "ever", "still", "always", "necessarily", "technically", "officially",
  "be", "is", "are", "was", "were", "been", "being",
  "have", "has", "had", "having",
  "include", "includes", "included", "including",
  "offer", "offers", "offered", "offering",
  "contain", "contains", "contained", "containing",
  "feature", "features", "featured", "featuring",
  "provide", "provides", "provided", "providing",
  "come", "comes", "boast", "boasts", "possess", "possesses",
  "hold", "holds", "accommodate", "accommodates", "sleep", "sleeps",
  "show", "shows", "list", "lists", "advertise", "advertises", "mention", "mentions",
  "count", "counts", "get", "gets", "got",
]);

/** Adverbs are open class, so they are recognised by shape rather than listed. */
const ADVERB = /^\p{L}+ly$/u;

/** Second bound on the gap, independent of what the words are. */
const MAX_INTERVENING_WORDS = 3;

/** How far back to look for a governing negator. */
const NEGATION_WINDOW = 80;

/**
 * Whether the text immediately before a match negates it.
 *
 * "no 3 beds", "does not have 3 beds" and "Status: not currently active"
 * negate. "no garage, 3 beds" and "No HOA | 3 beds" do not, because the
 * negator governs something else.
 *
 * @param {string} text full source text
 * @param {number} charStart index the match begins at
 * @returns {boolean}
 */
function isNegated(text, charStart) {
  const from = Math.max(0, charStart - NEGATION_WINDOW);
  const before = text.slice(from, charStart);

  // The nearest negator is the only one that can govern the match: anything
  // earlier is separated from it by the nearer one's own phrase.
  let negatorEnd = -1;
  NEGATOR.lastIndex = 0;
  for (let match = NEGATOR.exec(before); match !== null; match = NEGATOR.exec(before)) {
    negatorEnd = match.index + match[0].length;
    if (NEGATOR.lastIndex === match.index) NEGATOR.lastIndex += 1;
  }
  if (negatorEnd < 0) return false;

  const gap = before.slice(negatorEnd);
  if (ITEM_BOUNDARY.test(gap)) return false;

  const words = gap.split(/[^\p{L}\p{N}'\u2019]+/u).filter(Boolean);
  if (words.length > MAX_INTERVENING_WORDS) return false;
  if (words.some((word) => CONJUNCTION.test(word))) return false;
  return words.every((word) => LINKING.has(word.toLowerCase()) || ADVERB.test(word));
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
