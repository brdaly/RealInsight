export const SCORING_VERSION = "ri-v2.0";

const factIds = {
  askingPrice: "confirm:askingPrice:0",
  beds: "confirm:beds:0",
  baths: "confirm:baths:0",
  squareFeet: "confirm:squareFeet:0",
  daysOnMarket: "confirm:daysOnMarket:0",
  status: "confirm:status:0",
};

const criticalFactKeys = ["askingPrice", "beds", "baths", "squareFeet", "daysOnMarket", "status"];
const riskPhrases = ["cash only", "as-is", "as is", "tenant occupied", "unpermitted", "water damage", "foundation issue"];

function normalize(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function escaped(value) {
  return value.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
}

export function findSupportedPhrase(text, phrase) {
  const sourceText = String(text ?? "");
  const normalizedPhrase = normalize(phrase);
  if (!normalizedPhrase) return null;
  const pattern = escaped(normalizedPhrase).split(" ").join("\\s+");
  const match = new RegExp(`\\b${pattern}\\b`, "i").exec(sourceText);
  if (!match || match.index == null) return null;
  const prefix = sourceText.slice(Math.max(0, match.index - 36), match.index).toLowerCase();
  if (/\b(?:no|not|without|never)\b[^.!?;]{0,24}$/.test(prefix)) return null;
  return { quote: match[0], charStart: match.index, charEnd: match.index + match[0].length };
}

function semanticEvidence(kind, match, index) {
  return {
    id: `text:${kind}:${index}`,
    source: "listing_text",
    field: null,
    claim: `Listing language includes “${match.quote}”.`,
    quote: match.quote,
    charStart: match.charStart,
    charEnd: match.charEnd,
    confidence: "exact",
    status: "reported",
  };
}

function confirmedFactKnown(key, value) {
  return key === "status" ? value !== "unknown" : value != null;
}

export function decideListing({ profile, listingText, facts, evidenceLedger }) {
  const semanticEntries = [];
  const mustHaveMatch = findSupportedPhrase(listingText, profile.mustHave);
  const dealBreakerMatch = findSupportedPhrase(listingText, profile.dealBreaker);
  const riskMatches = riskPhrases
    .map((phrase) => ({ phrase, match: findSupportedPhrase(listingText, phrase) }))
    .filter((item) => item.match);

  if (mustHaveMatch) semanticEntries.push(semanticEvidence("must-have", mustHaveMatch, 0));
  if (dealBreakerMatch) semanticEntries.push(semanticEvidence("deal-breaker", dealBreakerMatch, 0));
  riskMatches.forEach((item, index) => {
    const duplicate = normalize(item.phrase) === normalize(profile.dealBreaker) && dealBreakerMatch;
    if (!duplicate) semanticEntries.push(semanticEvidence("condition", item.match, index));
  });

  const ledger = [...evidenceLedger, ...semanticEntries];
  const mustHaveEvidence = semanticEntries.find((entry) => entry.id.startsWith("text:must-have:"))?.id;
  const dealBreakerEvidence = semanticEntries.find((entry) => entry.id.startsWith("text:deal-breaker:"))?.id;
  const riskEvidence = semanticEntries.filter((entry) => entry.id.startsWith("text:condition:")).map((entry) => entry.id);
  const hardStops = [];

  if (facts.askingPrice != null && facts.askingPrice > profile.maxBudget) {
    hardStops.push("The confirmed asking price is above your maximum budget.");
  }
  if (facts.status === "pending" || facts.status === "sold") {
    hardStops.push(`The confirmed listing status is ${facts.status}.`);
  }
  if (dealBreakerMatch) {
    hardStops.push(`The listing contains your deal-breaker: “${profile.dealBreaker}”.`);
  }

  const knownFacts = criticalFactKeys.filter((key) => confirmedFactKnown(key, facts[key])).length;
  const evidenceCoverage = Math.round((knownFacts / criticalFactKeys.length) * 100);

  const findings = [
    {
      kind: "must_have",
      outcome: mustHaveMatch ? "supported" : "unknown",
      severity: mustHaveMatch ? "none" : "monitor",
      evidenceIds: mustHaveEvidence ? [mustHaveEvidence] : [],
      explanation: mustHaveMatch
        ? `The listing explicitly mentions your essential feature: “${profile.mustHave}”.`
        : `The listing does not clearly confirm your essential feature: “${profile.mustHave}”.`,
    },
    {
      kind: "deal_breaker",
      outcome: dealBreakerMatch ? "contradicted" : "unknown",
      severity: dealBreakerMatch ? "investigate" : "none",
      evidenceIds: dealBreakerEvidence ? [dealBreakerEvidence] : [],
      explanation: dealBreakerMatch
        ? "Your deal-breaker appears in the listing language."
        : "Your deal-breaker is not stated, but absence from marketing copy is not proof of absence.",
    },
    {
      kind: "condition",
      outcome: riskMatches.length ? "supported" : "unknown",
      severity: riskMatches.length ? "investigate" : "monitor",
      evidenceIds: riskEvidence,
      explanation: riskMatches.length
        ? `Risk language found: ${riskMatches.map((item) => item.phrase).join(", ")}.`
        : "No explicit condition warning was found; disclosures and an inspection are still required.",
    },
    {
      kind: "cost",
      outcome: facts.askingPrice == null ? "unknown" : facts.askingPrice <= profile.maxBudget ? "supported" : "contradicted",
      severity: facts.askingPrice == null || facts.askingPrice > profile.maxBudget ? "investigate" : "none",
      evidenceIds: [factIds.askingPrice],
      explanation: facts.askingPrice == null
        ? "The asking price remains unknown."
        : facts.askingPrice <= profile.maxBudget
          ? "The confirmed asking price is within your stated maximum budget."
          : "The confirmed asking price is above your stated maximum budget.",
    },
    {
      kind: "leverage",
      outcome: facts.daysOnMarket == null ? "unknown" : "supported",
      severity: "none",
      evidenceIds: [factIds.daysOnMarket],
      explanation: facts.daysOnMarket == null
        ? "Days on market is unknown."
        : `${facts.daysOnMarket} days on market is a question prompt, not a valuation conclusion.`,
    },
  ];

  let buyerFitScore = 0;
  if (facts.askingPrice != null) buyerFitScore += facts.askingPrice <= profile.maxBudget ? 35 : 0;
  if (mustHaveMatch) buyerFitScore += 35;
  if (facts.status === "active") buyerFitScore += 15;
  if (hardStops.length) buyerFitScore = 0;

  const verifyReasons = [];
  if (facts.status === "unknown") verifyReasons.push("Listing status is unconfirmed.");
  if (evidenceCoverage < 70) verifyReasons.push("Critical fact coverage is incomplete.");
  if (!mustHaveMatch) verifyReasons.push("Your essential feature is not clearly supported.");
  if (riskMatches.length) verifyReasons.push("Condition or transaction-risk language needs follow-up.");

  const decision = hardStops.length ? "stop" : verifyReasons.length ? "verify_first" : "tour_candidate";
  const decisionLabel = decision === "stop"
    ? "Stopped by your rules"
    : decision === "verify_first"
      ? "Verify before touring"
      : "Worth a closer look";
  const reasons = decision === "stop"
    ? hardStops
    : decision === "verify_first"
      ? verifyReasons
      : [
          "The confirmed price is within budget.",
          "The listing supports your essential feature.",
          "No stated deal-breaker triggered a stop.",
        ];

  const questions = [];
  if (facts.status === "unknown") questions.push({ question: "Can you confirm the current MLS status and any offer deadline?", evidenceIds: [factIds.status] });
  if (!mustHaveMatch) questions.push({ question: `Can you confirm whether the property includes ${profile.mustHave}?`, evidenceIds: [] });
  if (facts.daysOnMarket == null) questions.push({ question: "How long has the property been on market, including any relistings?", evidenceIds: [factIds.daysOnMarket] });
  if (riskMatches.length) questions.push({ question: "What disclosures, permits, or repair records address the risk language in the listing?", evidenceIds: riskEvidence });
  questions.push({ question: `Can you confirm that “${profile.dealBreaker}” is not present and will not affect possession or financing?`, evidenceIds: [] });
  questions.push({ question: "Please provide recent comparable sales, disclosures, annual taxes, and known major-system ages.", evidenceIds: [] });
  questions.push({ question: "What listing claims have supporting invoices, permits, warranties, or inspection records?", evidenceIds: [] });

  const summary = decision === "stop"
    ? "A confirmed buyer rule conflicts with this listing, so the workflow stops before producing a recommendation."
    : decision === "verify_first"
      ? "The listing may fit, but the evidence is not strong enough to recommend a tour without targeted verification."
      : "The listing clears the buyer’s confirmed rules and has enough evidence to justify a closer look—not an offer.";

  return {
    decision,
    decisionLabel,
    buyerFitScore,
    evidenceCoverage,
    hardStops,
    reasons,
    findings,
    evidenceLedger: ledger,
    questions: questions.slice(0, 4),
    summary,
    scoringVersion: SCORING_VERSION,
  };
}
