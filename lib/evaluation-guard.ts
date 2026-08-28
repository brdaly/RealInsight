import type { BuyerLens, ConfirmedListingFacts } from "./contracts";

export const MAX_LISTING_TEXT_LENGTH = 12_000;
export const MAX_REQUEST_BYTES = 40_000;

export type EvaluatePayload = {
  phase?: "extract" | "evaluate";
  profile?: BuyerLens;
  demoId?: string;
  listingText?: string;
  confirmedFacts?: ConfirmedListingFacts;
  factsConfirmed?: boolean;
  aiConsent?: boolean;
};

const validStatuses = new Set(["active", "pending", "sold", "unknown"]);

function validNullableNumber(value: unknown, min: number, max: number) {
  return value == null || (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max);
}

export function validateEvaluationPayload(payload: EvaluatePayload) {
  const errors: string[] = [];
  if (payload.phase !== "extract" && payload.phase !== "evaluate") {
    errors.push("Choose a valid workflow phase.");
  }
  if (typeof payload.profile?.maxBudget !== "number" || !Number.isFinite(payload.profile.maxBudget) || payload.profile.maxBudget < 10_000 || payload.profile.maxBudget > 50_000_000) {
    errors.push("Enter a valid maximum budget.");
  }
  if (!payload.profile?.mustHave?.trim() || payload.profile.mustHave.length > 120) {
    errors.push("Enter one essential feature.");
  }
  if (!payload.profile?.dealBreaker?.trim() || payload.profile.dealBreaker.length > 120) {
    errors.push("Enter one deal-breaker.");
  }
  if (!payload.demoId) {
    if (!payload.listingText?.trim() || payload.listingText.trim().length < 80) {
      errors.push("Paste at least 80 characters of listing text or choose a safe demo.");
    }
    if ((payload.listingText?.length ?? 0) > MAX_LISTING_TEXT_LENGTH) {
      errors.push(`Listing text must be ${MAX_LISTING_TEXT_LENGTH.toLocaleString()} characters or fewer.`);
    }
  }

  if (payload.phase === "evaluate") {
    const facts = payload.confirmedFacts;
    if (!facts) {
      errors.push("Review the extracted facts before continuing.");
    } else {
      if (!validNullableNumber(facts.askingPrice, 1, 50_000_000)) errors.push("The asking price is outside the supported range.");
      if (!validNullableNumber(facts.beds, 0, 100)) errors.push("The bedroom count is outside the supported range.");
      if (!validNullableNumber(facts.baths, 0, 100)) errors.push("The bathroom count is outside the supported range.");
      if (!validNullableNumber(facts.squareFeet, 1, 1_000_000)) errors.push("The square footage is outside the supported range.");
      if (!validNullableNumber(facts.daysOnMarket, 0, 10_000)) errors.push("Days on market is outside the supported range.");
      if (!validStatuses.has(facts.status)) errors.push("Choose a valid listing status.");
    }
    if (payload.factsConfirmed !== true) errors.push("Confirm that you reviewed the facts.");
    if (payload.aiConsent !== true) errors.push("Acknowledge the demo data notice before analysis.");
  }
  return errors;
}
