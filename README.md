# RealInsight V2

RealInsight is a Daly Ventures applied-AI demonstration for first-time home
buyers. It turns one listing description and three buyer boundaries into a
reviewable next step:

- **Stopped by your rules**
- **Verify before touring**
- **Worth a closer look**

The public demonstration is deliberately bounded. AI interprets language and
drafts evidence-linked questions. Versioned application code owns every rule,
fit calculation, coverage calculation, and decision state. A visitor must
review and confirm extracted facts before evaluation.

## Demonstration flow

1. Choose one clearly fictional scenario or paste public listing text.
2. Set a maximum budget, one essential feature, and one deal-breaker.
3. Review each extracted fact beside its exact source excerpt.
4. Correct or confirm the facts; unknowns may remain unknown.
5. Receive a decision state, buyer-fit indicator, evidence-coverage indicator,
   findings, evidence ledger, and questions for the listing agent.

The three built-in scenarios are synthetic and use no listing photos. The
prototype does not present a stale market feed, neighborhood, school, or safety
scores, an appraisal, an opening-offer range, or a ranked shortlist.

## Authority model

    Listing text + buyer boundaries
                  |
                  v
    Deterministic extraction + exact source spans
                  |
                  v
    Visitor review and confirmation gate
                  |
                  +-------------------------+
                  |                         |
                  v                         v
    Versioned rule engine              Bounded AI analysis
    (fit, coverage, stop/state)        (questions only)
                  |                         |
                  +------------+------------+
                               v
                     Reviewable decision brief

The scoring contract is versioned as **ri-v2.0**. Unsupported facts do not
receive synthetic credit. A model response cannot override a buyer’s budget or
deal-breaker and cannot generate a valuation or offer recommendation.

## Privacy and storage

- The application does not save listing text, buyer inputs, extracted facts, or
  decision briefs to a shortlist or application database.
- An anonymous HttpOnly session cookie supports abuse controls.
- When OPENAI_API_KEY is configured and the operator kill switch is on,
  confirmed listing text, confirmed facts, buyer boundaries, and the evidence
  ledger are sent server-side to the OpenAI Responses API for bounded question
  drafting.
- Visitors are told not to submit names, contact details, confidential
  information, or non-public documents.
- D1 stores only hashed rate-limit identities and timestamps, with stale
  request records cleaned opportunistically.

## Safety controls

- 12,000-character listing limit and 40 KB request limit
- Two-phase server contract: extract, then evaluate
- Required human fact confirmation and data notice
- Trusted server-side IDs for synthetic demos
- Server recomputation of extraction and evidence
- Exact quote and character-span preservation
- Negation-aware buyer deal-breaker matching
- Strict structured output for the bounded model step
- Hashed per-visitor OpenAI safety identifier
- 20 live-AI calls per visitor or IP per hour
- Configurable global daily live-AI ceiling
- Operator kill switch
- Deterministic fallback when AI is unavailable
- Generic public errors and no provider-detail leakage

RealInsight is decision support, not real-estate, appraisal, inspection,
lending, legal, or financial advice.

## Environment

Copy .env.example to .env.local:

    OPENAI_API_KEY=
    OPENAI_MODEL_ID=gpt-5.6
    REALINSIGHT_AI_ENABLED=true
    REALINSIGHT_DAILY_AI_CALL_LIMIT=500

OPENAI_API_KEY is optional for local development. Without it, the complete
evidence and deterministic decision workflow remains available and is labeled
**Rules demo**. Never put the API key in client code or a public field.

## Local development

Prerequisites: Node.js 22.13 or newer and pnpm.

    pnpm install
    pnpm dev

## Validation

    pnpm test

The test suite performs a production build and verifies exact evidence spans,
explicit evidence gaps, visitor corrections, deterministic decisions,
negation-aware deal-breakers, synthetic-demo provenance, the absence of legacy
offer, photo, and market-ranking surfaces, confirmation requirements, session
security, rate-limit identity handling, and the bounded OpenAI contract.

## Daly Ventures integration

The application is intended to run at a dedicated host such as
realinsight.dalyventures.com, with the main Squarespace site providing the
story, case study, and conversion path. This keeps the live application’s
runtime and security controls separate from the marketing CMS while preserving
one clear Daly Ventures brand experience.
