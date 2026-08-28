export const FACT_KEYS = ["askingPrice", "beds", "baths", "squareFeet", "daysOnMarket", "status"];

const labels = {
  askingPrice: "asking price",
  beds: "bedrooms",
  baths: "bathrooms",
  squareFeet: "square footage",
  daysOnMarket: "days on market",
  status: "listing status",
};

function displayValue(field, value) {
  if (value == null || value === "unknown") return "unknown";
  if (field === "askingPrice") return `$${Number(value).toLocaleString("en-US")}`;
  if (field === "squareFeet") return `${Number(value).toLocaleString("en-US")} sq ft`;
  return String(value);
}

export function buildEvidenceLedger(extraction) {
  return FACT_KEYS.map((field) => {
    const match = extraction.matches[field];
    const value = extraction.facts[field];
    return {
      id: `text:${field}:0`,
      source: "listing_text",
      field,
      claim: match
        ? `Listing reports ${labels[field]} as ${displayValue(field, value)}.`
        : `The listing does not clearly report ${labels[field]}.`,
      quote: match?.quote ?? null,
      charStart: match?.charStart ?? null,
      charEnd: match?.charEnd ?? null,
      confidence: match ? "exact" : "unknown",
      status: match ? "reported" : "unknown",
    };
  });
}

export function addVisitorConfirmations(ledger, extractedFacts, confirmedFacts) {
  const confirmations = FACT_KEYS.map((field) => {
    const original = extractedFacts[field];
    const confirmed = confirmedFacts[field];
    const corrected = String(original ?? "unknown") !== String(confirmed ?? "unknown");
    return {
      id: `confirm:${field}:0`,
      source: "visitor_confirmation",
      field,
      claim: corrected
        ? `Visitor corrected ${labels[field]} to ${displayValue(field, confirmed)}.`
        : `Visitor confirmed ${labels[field]} as ${displayValue(field, confirmed)}.`,
      quote: null,
      charStart: null,
      charEnd: null,
      confidence: "confirmed",
      status: "visitor_confirmed",
    };
  });
  return [...ledger, ...confirmations];
}

export function validateEvidenceReferences(items, ledger) {
  const validIds = new Set(ledger.map((entry) => entry.id));
  return items.map((item) => ({
    ...item,
    evidenceIds: Array.isArray(item.evidenceIds)
      ? [...new Set(item.evidenceIds.filter((id) => typeof id === "string" && validIds.has(id)))]
      : [],
  }));
}
