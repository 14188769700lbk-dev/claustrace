# Devpost submission draft

This document is working copy only. It is not authorization to publish a Devpost entry or a demo video.

## Submission facts

- Event: DevNetwork [API + Cloud + AI] Hackathon 2026
- Entrant: solo independent developer
- Team size: 1
- Target challenges: Nutrient DWS and SerpApi
- Submission deadline: September 3, 2026 at 10:00 AM PDT (September 4 at 1:00 AM UTC+8)
- Public repository: https://github.com/14188769700lbk-dev/claustrace
- Public demo: https://14188769700lbk-dev.github.io/claustrace/ (pending GitHub Pages enablement)
- Video: pending recording and public upload
- License: Apache-2.0

## Project name

ClauseTrace

## Elevator pitch

ClauseTrace turns contract and API-change notices into cited migration constraints, discovers current official-source material with SerpApi, routes uncertainty to a human reviewer, and builds an auditable evidence packet with Nutrient DWS.

## The whole story

### Inspiration

Migration teams often learn about compatibility windows, notice periods, rollback requirements, and approval owners from PDFs. Those obligations rarely arrive in the same system as the engineering change plan. Copying them by hand loses provenance; letting an AI silently fill the gaps creates a different risk.

ClauseTrace treats extraction, web discovery, human judgment, and packet generation as separate evidence stages. It is an engineering risk tool, not a lawyer: it organizes constraints for review, but it does not determine enforceability or authorize a production migration.

### What it does

The demo starts with a clearly fictional API data-change addendum. ClauseTrace:

1. extracts typed fields from the PDF with Nutrient Data Extraction;
2. preserves provider-returned citation boxes, source block IDs, match labels, and relative confidence scores;
3. discovers current material through a narrow SerpApi Google Search query restricted to an official-domain allowlist;
4. labels every search result `discovered`, never `verified`, until a reviewer opens an official source and records a digest;
5. blocks packet approval when required citations are missing or a contradiction remains unresolved;
6. records corrections as append-only review events; and
7. uses Nutrient DWS Processor to build a PDF evidence packet containing the reviewed fields and unresolved items.

The public no-login demo is intentionally a deterministic dry run. Provider credentials and paid-call surfaces remain on the trusted server and are not shipped to the browser.

### How we built it

ClauseTrace uses TypeScript, React, Vite, Express, Vitest, Nutrient Data Extraction, Nutrient DWS Processor, and the SerpApi Google Search API.

The implementation has a shared provider boundary so checked fixtures and live server adapters return the same evidence types. Provider keys are server-only. Requests fail closed when credentials are absent. Search domains use exact or subdomain matching, and provider errors are mapped to retry-safe states without leaking authorization data.

The build includes deterministic state-policy tests, adapter contract tests, a full Git-history secret scan, and production-bundle checks. The checked acceptance record documents one real SerpApi query, one real DWS PDF build, and successful real Nutrient extractions without storing request IDs, keys, or customer data.

### Challenges we ran into

The most important challenge was keeping provider output honest. Nutrient Data Extraction accepts a documented subset of JSON Schema rather than every annotation, and its parse modes are `structure`, `understand`, or `agentic`. The adapter therefore removes unsupported schema titles, uses `structure`, preserves relative confidence without presenting it as a probability, and never fabricates quotation text when the provider returns coordinates without a quote.

SerpApi created a different evidence problem: a search result can discover a potentially relevant official page, but its title or snippet is not proof of an obligation. ClauseTrace keeps discovery metadata separate from reviewed evidence and requires an opened official source plus a captured digest before it can affect approval.

### Accomplishments that we're proud of

- Real Nutrient extraction returned all six required synthetic-demo fields with provider citation boxes and relative confidence scores.
- A real Nutrient Processor call produced a valid one-page PDF evidence packet from the checked synthetic case.
- A real allowlisted SerpApi query returned ten official-domain results, all retained as discovery rather than silently promoted to evidence.
- The public client contains no provider keys or live mutation controls.
- The current verification suite passes 33 tests, a production build, client-bundle checks, and a full-history secret scan.

### What we learned

Trustworthy document automation is less about adding one model call and more about preserving boundaries: source data versus accepted values, discovery versus evidence, relative scores versus probabilities, and packet integrity versus legal correctness. Those distinctions also make provider failures and human corrections easier to explain and audit.

### What's next

The next product step is a private deployment with authenticated uploads, durable review-event storage, opened-source capture, and organization-specific approval policies. Any commercial use would also require provider plans whose terms permit it; the SerpApi free plan used for this hackathon is labeled non-commercial.

## Sponsor lines

### Nutrient DWS

Nutrient does the document-heavy lifting: Data Extraction maps the synthetic PDF into typed fields with source coordinates and relative confidence, while DWS Processor renders the reviewed evidence packet as a real PDF.

### SerpApi

SerpApi supplies structured, live official-domain search results that create a separate current-source review queue; ClauseTrace deliberately keeps snippets as discovery until a human verifies the underlying source.

## Built with

- TypeScript
- React
- Vite
- Express
- Vitest
- Nutrient DWS Processor
- Nutrient Data Extraction
- SerpApi Google Search API
- GitHub Actions
- GitHub Pages

## Links to provide

- Source and setup: https://github.com/14188769700lbk-dev/claustrace
- Provider acceptance record: https://github.com/14188769700lbk-dev/claustrace/blob/main/evidence/provider-acceptance-2026-08-19.json
- Provider boundary notes: https://github.com/14188769700lbk-dev/claustrace/blob/main/docs/provider-integrations.md
- Try it out: https://14188769700lbk-dev.github.io/claustrace/ (do not enter until it returns HTTP 200)
- Demo video: `TODO_PUBLIC_VIDEO_URL`

## Image gallery plan

Use screenshots that contain synthetic data only and no browser account chrome, request IDs, provider keys, email addresses, or dashboard identifiers.

1. [`claustrace-overview.png`](assets/claustrace-overview.png) — full review console with the synthetic addendum and dry-run boundary.
2. [`claustrace-cited-review.png`](assets/claustrace-cited-review.png) — one field with its citation box and fixture score, visibly distinguished from live Nutrient provenance.
3. [`claustrace-source-discovery.png`](assets/claustrace-source-discovery.png) — allowlisted and outside-domain results with discovery/evidence status shown separately.
4. [`claustrace-evidence-packet.png`](assets/claustrace-evidence-packet.png) — generated draft, unresolved blockers, and the `Not sealed` boundary.
5. [`claustrace-mobile.png`](assets/claustrace-mobile.png) — the responsive public dry-run entry path.

The checked gallery images in [`docs/assets/`](assets/) can be reproduced while the local Vite server is running:

```bash
node scripts/capture-submission-gallery.mjs http://127.0.0.1:4177/
```

The script controls a temporary headless Edge/Chrome profile through the local DevTools protocol, writes five synthetic-data screenshots, and deletes the temporary profile when finished. Set `BROWSER_PATH` when the browser is not in a standard Windows installation path.

## Pre-publication audit

- [ ] GitHub Pages is enabled and the no-login URL returns HTTP 200.
- [ ] Fresh incognito load works on desktop and mobile.
- [ ] Repository setup instructions succeed from a clean checkout.
- [ ] `npm run verify` passes on the final commit.
- [ ] Screenshot and video frames contain only synthetic data.
- [ ] Video is public, 2–4 minutes, and shows the working product end to end.
- [ ] Video narration distinguishes the public dry run from recorded live-provider acceptance.
- [ ] Both Nutrient DWS and SerpApi challenges are selected.
- [ ] Repository URL, demo URL, and video URL are correct.
- [ ] No claim says the packet is legal advice, a production authorization, or proof that a clause is enforceable.
- [ ] No claim says SerpApi snippets are verified evidence or that its free plan permits commercial production use.
- [ ] The account owner has explicitly confirmed the final Devpost publication.
