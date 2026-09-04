# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-09-04

### Initial Release

#### Added
- Property evaluation dashboard with deterministic decision rules
- Cloudflare D1 database schema for property records, assessments, and decisions
- REST API endpoints for property queries and decision verification
- Drizzle ORM schema definitions and SQL migrations
- TypeScript configuration and linting standards
- GitHub Actions CI workflow for testing and validation
- Documentation: README, CONTRIBUTING.md, CHANGELOG

#### Security
- Remediated vulnerable transitive dependencies (fast-uri → 3.1.6)
- Added Dependabot configuration for automated security updates
- Implemented @types/node pinning policy for Node.js 22+ compatibility
- Added pnpm audit checks to CI/CD pipeline
- Owner authorization requirements for decision publication

#### Changed
- Updated @vitejs/plugin-react to latest compatible version
- Upgraded Next.js framework dependencies to v16
- Enhanced Dependabot configuration for semantic versioning

#### Fixed
- Dependabot YAML syntax validation
- Type compatibility with Node.js 22+
- Production D1 database release hardening

### Technology
- Next.js 16.2
- React 19
- TypeScript 5.9
- Cloudflare Workers and D1
- Drizzle ORM 0.45

### Status
- Production-ready database schema and API
- Labs/prototype status for evaluation logic (requires verification)
- Not activation-ready: requires integration testing and operational hardening

### Known Limitations
- Live property data integration not yet connected
- Evaluation rules require domain expert verification before production use
- Rate limiting and deployment gates pending verification

---

For more information, see [CONTRIBUTING.md](CONTRIBUTING.md) and [README.md](README.md).
