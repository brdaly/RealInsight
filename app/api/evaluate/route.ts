import type { ConfirmedListingFacts, DecisionResult, EvidenceEntry, ExtractionDraft } from "@/lib/contracts";
import { getDemoListing } from "@/lib/demo-listings";
import { addVisitorConfirmations, buildEvidenceLedger } from "@/lib/evidence-ledger.mjs";
import { MAX_REQUEST_BYTES, type EvaluatePayload, validateEvaluationPayload } from "@/lib/evaluation-guard";
import { extractListingWithEvidence } from "@/lib/extractor.mjs";
import { analyzeWithOpenAI } from "@/lib/openai-analysis";
import { claimEvaluationRequest } from "@/lib/rate-limit";
import { PublicRequestError, readBoundedJson, requireSameOrigin } from "@/lib/request-json";
import { decideListing } from "@/lib/scoring.mjs";
import { getVisitorSession, visitorJson } from "@/lib/visitor-session";

export const runtime = "nodejs";

async function hashedSafetyIdentifier(visitorId: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`realinsight:v2:${visitorId}`),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function resolveListing(payload: EvaluatePayload) {
  if (payload.demoId) {
    const demo = getDemoListing(payload.demoId);
    if (!demo) return null;
    return {
      text: demo.listingText,
      provenance: {
        kind: "synthetic_demo" as const,
        label: `${demo.label} — synthetic example, not a live listing`,
        checkedAt: null,
      },
    };
  }
  return {
    text: payload.listingText!.trim(),
    provenance: {
      kind: "user_supplied" as const,
      label: "Text supplied by this visitor; not independently verified",
      checkedAt: null,
    },
  };
}

function draftFor(payload: EvaluatePayload): ExtractionDraft | null {
  const resolved = resolveListing(payload);
  if (!resolved) return null;
  const extraction = extractListingWithEvidence(resolved.text);
  return {
    facts: extraction.facts as ConfirmedListingFacts,
    evidenceLedger: buildEvidenceLedger(extraction) as EvidenceEntry[],
    provenance: resolved.provenance,
    listingText: resolved.text,
  };
}

export async function POST(request: Request) {
  const visitor = getVisitorSession(request);
  try {
    requireSameOrigin(request);
    const payload = await readBoundedJson<EvaluatePayload>(request, MAX_REQUEST_BYTES);
    const errors = validateEvaluationPayload(payload);
    if (errors.length) return visitorJson(visitor, { error: errors.join(" ") }, { status: 400 });

    const draft = draftFor(payload);
    if (!draft) return visitorJson(visitor, { error: "Choose a valid safe demo." }, { status: 400 });
    if (payload.phase === "extract") {
      return visitorJson(visitor, { draft, persistence: "not_saved" });
    }

    const extraction = extractListingWithEvidence(draft.listingText);
    const confirmedFacts = payload.confirmedFacts!;
    const confirmedLedger = addVisitorConfirmations(
      buildEvidenceLedger(extraction),
      extraction.facts,
      confirmedFacts,
    ) as EvidenceEntry[];
    const deterministic = decideListing({
      profile: payload.profile!,
      listingText: draft.listingText,
      facts: confirmedFacts,
      evidenceLedger: confirmedLedger,
    }) as Omit<DecisionResult, "analysisMode" | "analysisNotice">;

    let analysisMode: DecisionResult["analysisMode"] = "deterministic-demo";
    let analysisNotice = "The evidence and decision workflow ran locally. Live AI analysis is not configured in this environment.";
    let questions = deterministic.questions;
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const aiEnabled = process.env.REALINSIGHT_AI_ENABLED?.trim().toLowerCase() === "true";

    if (apiKey && aiEnabled) {
      try {
        const rateLimitSecret = process.env.REALINSIGHT_RATE_LIMIT_HASH_SECRET?.trim() || apiKey;
        const rateLimit = await claimEvaluationRequest(request, visitor.id, rateLimitSecret);
        if (rateLimit.allowed) {
          const analysis = await analyzeWithOpenAI({
            apiKey,
            safetyIdentifier: await hashedSafetyIdentifier(visitor.id),
            profile: payload.profile!,
            listingText: draft.listingText,
            facts: confirmedFacts,
            evidenceLedger: deterministic.evidenceLedger,
          });
          const uniqueQuestions = [...analysis.questions, ...deterministic.questions]
            .filter((item, index, all) =>
              all.findIndex((candidate) => candidate.question.toLowerCase() === item.question.toLowerCase()) === index
            )
            .slice(0, 4);
          questions = uniqueQuestions;
          analysisMode = "ai-assisted";
          analysisNotice = "OpenAI drafted the evidence-linked follow-up questions. Versioned code—not the model—applied the rules and made the decision.";
        } else {
          analysisNotice = rateLimit.scope === "global"
            ? "The live-AI safety ceiling has been reached; the deterministic evidence workflow still completed."
            : "This visitor reached the live-AI rate limit; the deterministic evidence workflow still completed.";
        }
      } catch {
        analysisNotice = "Live AI was unavailable, so the deterministic evidence workflow completed without it.";
      }
    } else if (!aiEnabled) {
      analysisNotice = "Live AI is paused by the operator kill switch; the deterministic evidence workflow still completed.";
    }

    const result: DecisionResult = {
      ...deterministic,
      questions,
      analysisMode,
      analysisNotice,
    };
    return visitorJson(visitor, {
      result,
      provenance: draft.provenance,
      confirmedFacts,
      persistence: "not_saved",
    });
  } catch (error) {
    if (error instanceof PublicRequestError) {
      return visitorJson(visitor, { error: error.message }, { status: error.status });
    }
    return visitorJson(visitor, { error: "RealInsight could not complete this step. Please try again." }, { status: 500 });
  }
}
