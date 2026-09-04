# Contributing

Use a small branch and pull request. Every behavioral change needs a deterministic test or a governed evaluation case. Never weaken decision-boundary confidence, property-data verification, price-freshness requirements, owner authorization, or the separation between evaluation logic, market evidence, condition assessment, and pricing.

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm audit --prod` before opening a pull request. Do not commit secrets, raw property photos, source workbooks, scraped property datasets, market exports, unlicensed comparable data, or third-party source copies without attribution.

Schema changes are append-only SQL migrations managed through Drizzle. Record consequential architecture choices as an ADR under `docs/adr/`.

Property data sources must maintain provenance, observation date, verification status, and original attribution. Never treat preliminary estimates, seller claims, or outdated comparables as verified facts. Decisions remain provisional until independently verified against current market conditions and ownership records.
