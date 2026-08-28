export type ListingStatus = "active" | "pending" | "sold" | "unknown";

export type BuyerLens = {
  maxBudget: number;
  mustHave: string;
  dealBreaker: string;
};

export type FactKey =
  | "askingPrice"
  | "beds"
  | "baths"
  | "squareFeet"
  | "daysOnMarket"
  | "status";

export type ConfirmedListingFacts = {
  askingPrice: number | null;
  beds: number | null;
  baths: number | null;
  squareFeet: number | null;
  daysOnMarket: number | null;
  status: ListingStatus;
};

export type EvidenceEntry = {
  id: string;
  source: "listing_text" | "visitor_confirmation";
  field: FactKey | null;
  claim: string;
  quote: string | null;
  charStart: number | null;
  charEnd: number | null;
  confidence: "exact" | "confirmed" | "unknown";
  status: "reported" | "visitor_confirmed" | "unknown";
};

export type Provenance = {
  kind: "synthetic_demo" | "user_supplied";
  label: string;
  checkedAt: string | null;
};

export type Finding = {
  kind: "must_have" | "deal_breaker" | "condition" | "cost" | "leverage";
  outcome: "supported" | "contradicted" | "unknown";
  severity: "none" | "monitor" | "investigate";
  evidenceIds: string[];
  explanation: string;
};

export type AgentQuestion = {
  question: string;
  evidenceIds: string[];
};

export type DecisionResult = {
  decision: "stop" | "verify_first" | "tour_candidate";
  decisionLabel: "Stopped by your rules" | "Verify before touring" | "Worth a closer look";
  buyerFitScore: number | null;
  evidenceCoverage: number;
  hardStops: string[];
  reasons: string[];
  findings: Finding[];
  evidenceLedger: EvidenceEntry[];
  questions: AgentQuestion[];
  summary: string;
  scoringVersion: "ri-v2.0";
  analysisMode: "ai-assisted" | "deterministic-demo";
  analysisNotice: string;
};

export type ExtractionDraft = {
  facts: ConfirmedListingFacts;
  evidenceLedger: EvidenceEntry[];
  provenance: Provenance;
  listingText: string;
};
