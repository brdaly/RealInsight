# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Dependency maintenance on the weekly Dependabot cadence: Next.js and
  `eslint-config-next` to 16.3.4, `@cloudflare/vite-plugin` to 1.54.4,
  `wrangler` to 4.129.0, `vinext` to 1.0.0-beta.9, `@types/react-dom` to 19.2.7.

### Fixed
- Corrected the 0.1.0 release date, which had been recorded as 2024.
- Rewrote this entry and `CONTRIBUTING.md`, both of which described
  subsystems the application does not contain.

## [0.1.0] - 2026-09-04

First public demonstration.

### Added
- Two-phase evaluation flow over one listing description and three buyer
  boundaries: deterministic extraction, then a required human confirmation
  step, then evaluation.
- Deterministic extraction that preserves each fact's verbatim excerpt and
  character span from the submitted text, so every claim shown to the visitor
  can be traced back to the source.
- Versioned scoring contract `ri-v2.0` owning decision state, buyer fit, and
  evidence coverage in application code. Unsupported facts receive no
  synthetic credit, and no model response can override a budget or a
  deal-breaker.
- Three clearly fictional built-in scenarios, resolved from trusted
  server-side identifiers, with no listing photos.
- Optional bounded AI step, off by default, limited to drafting questions for
  the listing agent under strict structured output. Evidence references the
  model invents are stripped before display, and a deterministic fallback
  completes the workflow whenever the model is unavailable or refuses.
- Evidence ledger, findings, and agent questions in the returned decision
  brief.
- `/privacy` and `/disclaimer` routes, and `PRIVACY.md`.

### Security
- Operator kill switch (`REALINSIGHT_AI_ENABLED`), a per-visitor and per-IP
  ceiling of 20 live-AI calls per hour, and a configurable global daily
  ceiling on live-AI calls.
- Rate-limit identities stored as keyed hashes only. The raw
  Cloudflare-provided address and session identifier are never written to the
  database, and records older than 24 hours are cleaned opportunistically.
- Anonymous `HttpOnly`, `SameSite=Lax` session cookie for abuse control, with
  no account and no personal data.
- 12,000-character listing limit and a 40 KB request limit.
- Server-side recomputation of extraction and evidence; client-supplied
  scores are never trusted.
- Generic public error messages with no provider detail leakage.
- Dependabot configuration, `pnpm audit` in CI, and a pinned `@types/node`
  policy for the Node 22 runtime.

### Removed
- Legacy `evaluations`, `listings`, and `buyer_profiles` tables, via
  idempotent migration `0003_remove_legacy_storage.sql`. The runtime schema is
  now a single `evaluation_requests` table holding keyed-hash rate-limit
  identities and timestamps. Listing text, buyer inputs, extracted facts, and
  decision briefs are not persisted.

### Technology
- Next.js 16.3.4 on Cloudflare Workers via vinext
- React 19.2
- TypeScript 6.0.3
- Cloudflare D1 with Drizzle ORM 0.45
- Node.js 22

### Status
Public portfolio demonstration, not a production service. The deterministic
workflow is complete and covered by tests. Live AI is opt-in and off by
default.

### Known limitations
- No live property data source is connected, by design. The demonstration
  evaluates text a visitor supplies.
- The evaluation rules express one buyer's boundaries and have not been
  reviewed by a domain expert.
- Committing migration `0003` does not mean a deployed D1 database has run
  it. The release and rollback gates are in
  [docs/production-d1.md](docs/production-d1.md), and the legacy-table drop is
  irreversible under the managed Sites interface.
- RealInsight is decision support, not real-estate, appraisal, inspection,
  lending, legal, or financial advice.

---

For more information, see [CONTRIBUTING.md](CONTRIBUTING.md) and [README.md](README.md).
