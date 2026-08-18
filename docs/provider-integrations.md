# Provider integrations

Checked against official provider documentation and live synthetic acceptance on 2026-08-19.

## Verified contracts

| Capability | Server contract | ClauseTrace treatment |
| --- | --- | --- |
| SerpApi Google Search | `GET https://serpapi.com/search`, `engine=google`, required `q` and `api_key`; successful results carry `search_metadata.id`, `search_metadata.status`, and `organic_results` | The key is a server-only query parameter and is never placed in an error, log, response, or client bundle. Search snippets remain `discovered` with no source digest. |
| Nutrient DWS PDF build | `POST https://api.nutrient.io/build`, bearer authentication, multipart HTML asset plus JSON `instructions` | Only the checked synthetic fixture is rendered. The response must be `application/pdf`, begin with `%PDF-`, and remain at or below 20 MiB. |
| Nutrient Data Extraction | `POST https://api.nutrient.io/extraction/extract`, bearer authentication, multipart `file` plus a JSON `instructions` field containing `schema`, `parseConfig`, and `options` | Uses a separate Data Extraction product key. The checked route sends only the synthetic PDF, requests the lowest-cost supported extract mode (`structure`) plus citations, preserves bbox/match metadata, and never invents a quote or missing confidence score. |

Official references:

- [SerpApi Google Search API](https://serpapi.com/search-api)
- [Nutrient DWS API overview](https://www.nutrient.io/guides/dws-processor/developer-guides/)
- [Nutrient DWS getting started](https://www.nutrient.io/guides/dws-processor/getting-started/)
- [Nutrient Extract endpoint](https://www.nutrient.io/guides/dws-data-extraction/extract/)
- [Nutrient citations and confidence](https://www.nutrient.io/guides/dws-data-extraction/extract/citations-and-confidence/)

## Corrected extraction boundary

The earlier marketing page alone was not enough to implement extraction safely. The current official developer guide now documents the endpoint, multipart shape, response structure, citation fields, and confidence semantics. The account dashboard separately confirms Data Extraction entitlement. ClauseTrace therefore implements extraction with `NUTRIENT_EXTRACTION_API_KEY`; it does not reuse the Processor key.

The general product overview lists four parse modes, including `text`. The extract-specific parse-configuration guide and a real fail-closed acceptance request establish that `/extraction/extract` accepts `structure`, `understand`, or `agentic`; `text` is rejected at `$.parseConfig.mode`. ClauseTrace therefore constrains the adapter type to those three modes and defaults to `structure` for this clean synthetic document.

The provider's supported JSON Schema subset also rejects the otherwise common `title` annotation. ClauseTrace keeps `title` locally for review labels but recursively removes it from the provider payload; `description` remains the extraction guidance.

Nutrient states that extraction confidence is relative and uncalibrated, not a probability. ClauseTrace displays it as a relative score, leaves an omitted score absent, and still requires explicit human review for required fields. A bbox citation has no source quote in the documented response, so ClauseTrace records coordinate grounding and match label instead of fabricating quoted text.

## Trusted-server routes

- `GET /api/health` returns provider-presence booleans only.
- `GET /api/demo` returns the checked synthetic case.
- `POST /api/live/search` accepts a query and up to eight bare official domains. It rejects schemes, paths, and lookalike-domain matches.
- `POST /api/live/build-synthetic-packet` requires `{ "confirm": "BUILD SYNTHETIC PACKET" }` and returns a PDF only after strict response validation.
- `POST /api/live/extract-synthetic` requires `{ "confirm": "EXTRACT SYNTHETIC DOCUMENT" }`, reads only the checked synthetic PDF, and uses the separate Data Extraction key.

The server binds to `127.0.0.1`. The planned no-login public demo is the static fixture client, not an unauthenticated proxy to paid provider credits.

## Acceptance gates before a live claim

1. Inject keys only through local server environment variables; never copy them into source, chat, shell output, Git, or a `VITE_` variable.
2. Run one synthetic SerpApi query and confirm the dashboard usage increment, provider search ID, official-domain classification, and `discovered` state.
3. Run one confirmed synthetic Nutrient build and validate the returned PDF and dashboard usage. Free-plan watermarking is acceptable for the hackathon demo.
4. Run one confirmed synthetic extraction, validate value/citation mapping, and confirm the separate Data Extraction dashboard usage increment before describing extraction as live.
5. Re-run tests, production builds, client-bundle scans, credential-pattern scans, and Git-history scans before deployment or submission.

The 2026-08-19 synthetic acceptance passed these gates. See [`../evidence/provider-acceptance-2026-08-19.json`](../evidence/provider-acceptance-2026-08-19.json) for the redacted record, including the two fail-closed 400 responses that corrected the supported mode and schema subset before the successful live extraction.
