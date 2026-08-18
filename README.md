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

## Synthetic document

The checked source text is in [`fixtures/synthetic-api-change-addendum.md`](fixtures/synthetic-api-change-addendum.md). The generated PDF is fictional and contains no customer or confidential data.

## License

Apache-2.0. See [`LICENSE`](LICENSE).
