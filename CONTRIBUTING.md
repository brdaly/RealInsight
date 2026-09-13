# Contributing

Use a small branch and a pull request. Every behavioral change needs a deterministic test.

## The boundaries that must not weaken

These are the properties the demonstration exists to show. A change that erodes one of them is not a refactor, whatever else it does.

- **Extraction preserves the source exactly.** Every extracted fact keeps its verbatim excerpt and character span from the submitted listing text. Never paraphrase into the evidence ledger, and never widen a span to make a match work.
- **Unknowns stay unknown.** A fact the text does not support is absent, not inferred and not defaulted. Nothing receives synthetic credit for missing information.
- **The rule engine owns every consequential decision.** Decision state, buyer fit, and evidence coverage are computed in versioned application code under the `ri-v2.0` scoring contract. A model response must never set them, override a budget, or override a deal-breaker.
- **The model drafts questions and nothing else.** The bounded AI step may propose questions for the listing agent, tied to evidence identifiers that already exist. Evidence references it invents are stripped before display. If the model is unavailable or refuses, the deterministic path must still complete.
- **The confirmation gate holds.** Evaluation runs only after the visitor has reviewed and confirmed the extracted facts. Do not add a path that evaluates unconfirmed input.
- **The server recomputes.** Never trust client-supplied extraction, evidence, or scores.

If a change needs to move one of these lines, say so explicitly in the pull request and explain what replaces the guarantee.

## Before opening a pull request

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm audit --prod --audit-level high
```

`pnpm test` builds, verifies the deployment package, and runs the unit suite under `tests/`.

Add the test at the level where the failure could recur:

| Change | Test to add |
|---|---|
| Extraction or spans | `tests/extractor.test.mjs` |
| Scoring, decision state, coverage | `tests/deterministic-scoring.test.mjs` |
| Model request or response handling | `tests/openai-analysis.test.mjs` |
| Rate limiting or identity hashing | `tests/rate-limit-core.test.mjs` |
| Session cookies | `tests/session-security.test.mjs` |
| Schema or migrations | `tests/storage-migration.test.mjs` |
| Anything a visitor reads | `tests/public-readiness.test.mjs`, `tests/rendered-html.test.mjs` |

## Never commit

Secrets or live credentials of any kind, real listing text tied to an identifiable person or address, or third-party copy without attribution. `.env.example` holds empty values and stays that way.

`OPENAI_API_KEY` and `REALINSIGHT_RATE_LIMIT_HASH_SECRET` are environment-only. Do not add a code path that falls back to a committed default.

## Data and schema

The runtime schema is deliberately small: `evaluation_requests` holds keyed-hash rate-limit identities and timestamps, and nothing else. Listing text, buyer boundaries, extracted facts, and decision briefs are not persisted. A change that introduces storage of visitor input is a change to the privacy posture, and needs `PRIVACY.md`, `app/privacy/page.tsx`, and the README updated in the same pull request.

Schema changes are SQL migrations generated through Drizzle (`pnpm db:generate`). Migrations must be idempotent. Committing a migration does not mean a deployed database has run it; the release and rollback gates are in [docs/production-d1.md](docs/production-d1.md), and destructive migrations stay behind the separate approval gate described there.

## Documentation

`README.md`, `PRIVACY.md`, `app/privacy/page.tsx`, and `CHANGELOG.md` are part of the product. If a change makes any of them inaccurate, fix them in the same pull request. Claims in the README should be things a reader can verify in the code.

## Releases

No version tag without verification: CI green, the deployment state confirmed, and a CHANGELOG entry that describes what actually changed.
