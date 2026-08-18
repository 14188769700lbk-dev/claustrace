# ClauseTrace

ClauseTrace turns a contract or API-change notice into cited data-migration constraints, discovers current official-source material through SerpApi, routes uncertainty to a human reviewer, and builds an evidence packet through Nutrient DWS.

ClauseTrace is an engineering risk tool, not a lawyer. It organizes evidence and proposed controls for review. It does not provide legal advice, determine enforceability, or authorize a production migration.

## Build provenance

- Event: DevNetwork API + Cloud + AI Hackathon 2026
- Official build window opened: 2026-08-18 01:00 +08:00
- New local repository initialized: 2026-08-18 23:07:07 +08:00
- No implementation source was copied from an earlier project
- Pre-window planning remains in the separate LineageMedic repository

See [`BUILD_ORIGIN.json`](BUILD_ORIGIN.json) for the machine-readable record.

## Evidence boundary

- The public demo uses a fictional API addendum and checked dry-run fixtures.
- SerpApi snippets are always `discovered`, never verified evidence.
- A reviewed source needs an opened official URL and captured content digest.
- Missing citations, low-confidence required fields, or unresolved contradictions block packet approval.
- Corrections append immutable review events instead of overwriting extraction evidence.
- `sealed` means only that a packet was finalized; it does not authorize a migration.
- Provider keys stay server-only and are never prefixed with `VITE_`.

## Local development

```bash
npm install
npm run generate:pdf
npm run verify
npm run dev
```

The static Vite client is a no-login dry run. Live Nutrient and SerpApi adapters run only through the trusted Express server and fail closed without server-only keys.

## Provider status

- SerpApi Google Search is implemented server-side against the documented `q`, `api_key`, `search_metadata`, and `organic_results` contract. Results enter the review queue as `discovered`; a snippet is never treated as verified evidence.
- Nutrient DWS packet generation is implemented server-side against the documented authenticated multipart `POST /build` contract. The route only renders the checked synthetic case and requires the exact confirmation `BUILD SYNTHETIC PACKET` because a real request can consume provider credits.
- Nutrient `/extract` is deliberately unavailable. Its current authenticated request schema and this account's entitlement have not been verified, so the server returns `501 provider_contract_unverified` instead of inventing a request or relabeling fixtures.
- The SerpApi free plan shown during account setup is non-commercial. This prototype does not claim a production or commercial-use entitlement; current plan terms must be checked before customer work.

See [`docs/provider-integrations.md`](docs/provider-integrations.md) for the threat boundary, routes, and acceptance gates.

## Synthetic document

The checked source text is in [`fixtures/synthetic-api-change-addendum.md`](fixtures/synthetic-api-change-addendum.md). The generated PDF is fictional and contains no customer or confidential data.

## License

Apache-2.0. See [`LICENSE`](LICENSE).
