# Provider integrations

Checked against official provider documentation on 2026-08-18.

## Verified contracts

| Capability | Server contract | ClauseTrace treatment |
| --- | --- | --- |
| SerpApi Google Search | `GET https://serpapi.com/search`, `engine=google`, required `q` and `api_key`; successful results carry `search_metadata.id`, `search_metadata.status`, and `organic_results` | The key is a server-only query parameter and is never placed in an error, log, response, or client bundle. Search snippets remain `discovered` with no source digest. |
| Nutrient DWS PDF build | `POST https://api.nutrient.io/build`, bearer authentication, multipart HTML asset plus JSON `instructions` | Only the checked synthetic fixture is rendered. The response must be `application/pdf`, begin with `%PDF-`, and remain at or below 20 MiB. |

Official references:

- [SerpApi Google Search API](https://serpapi.com/search-api)
- [Nutrient DWS API overview](https://www.nutrient.io/guides/dws-processor/developer-guides/)
- [Nutrient DWS getting started](https://www.nutrient.io/guides/dws-processor/getting-started/)

## Intentionally unavailable

Nutrient's current product page advertises an `/extract` API with JSON Schema mapping, confidence, citations, and source coordinates. That public page does not establish the authenticated multipart request contract or prove that the current DWS Processor key has Data Extraction entitlement. ClauseTrace therefore returns `501 provider_contract_unverified` from `/api/live/extract` and keeps all checked extraction coordinates labeled `synthetic_fixture`.

Reference: [Nutrient Data Extraction API](https://www.nutrient.io/api/data-extraction-api/).

## Trusted-server routes

- `GET /api/health` returns provider-presence booleans only.
- `GET /api/demo` returns the checked synthetic case.
- `POST /api/live/search` accepts a query and up to eight bare official domains. It rejects schemes, paths, and lookalike-domain matches.
- `POST /api/live/build-synthetic-packet` requires `{ "confirm": "BUILD SYNTHETIC PACKET" }` and returns a PDF only after strict response validation.
- `POST /api/live/extract` is fail-closed as described above.

The server binds to `127.0.0.1`. The planned no-login public demo is the static fixture client, not an unauthenticated proxy to paid provider credits.

## Acceptance gates before a live claim

1. Inject keys only through local server environment variables; never copy them into source, chat, shell output, Git, or a `VITE_` variable.
2. Run one synthetic SerpApi query and confirm the dashboard usage increment, provider search ID, official-domain classification, and `discovered` state.
3. Run one confirmed synthetic Nutrient build and validate the returned PDF and dashboard usage. Free-plan watermarking is acceptable for the hackathon demo.
4. Verify `/extract` using provider-authenticated documentation and account entitlement before adding an adapter. Until then, do not describe ClauseTrace as performing live Nutrient extraction.
5. Re-run tests, production builds, client-bundle scans, credential-pattern scans, and Git-history scans before deployment or submission.
