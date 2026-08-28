const patterns = {
  askingPrice: /(?:\$|USD\s*)\s*([0-9]{2,3}(?:,[0-9]{3})+|[0-9]{5,7})/i,
  squareFeet: /([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,5})\s*(?:sq\.?\s*ft\.?|square\s*feet)/i,
  daysOnMarket: /(?:days?\s+on\s+market|DOM)\s*[:\-]?\s*([0-9]{1,4})/i,
  beds: /([0-9]+(?:\.[05])?)\s*(?:bed(?:room)?s?|bd)\b/i,
  baths: /([0-9]+(?:\.[05])?)\s*(?:bath(?:room)?s?|ba)\b/i,
};

function numericMatch(text, pattern) {
  const match = pattern.exec(text);
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
    const match = candidate.pattern.exec(text);
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
  const text = String(rawText ?? "").replaceAll("\u00a0", " ");
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
