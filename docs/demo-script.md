# ClauseTrace demo script

Target length: 3 minutes 20 seconds. Record only synthetic data. Do not show provider dashboards, environment files, request IDs, email addresses, or keys.

## 0:00–0:20 — Problem and boundary

**Screen:** ClauseTrace landing state and synthetic-document notice.

**Narration:**

“Migration teams receive critical constraints in PDFs, while engineers work in tickets and schemas. ClauseTrace turns a change notice into cited migration controls without pretending that an AI has made a legal decision. This demo uses a fictional addendum; ClauseTrace organizes evidence for human review and never authorizes a production migration.”

## 0:20–0:55 — Cited Nutrient extraction

**Screen:** Select the fictional addendum, then focus on the compatibility window and rollback requirement.

**Narration:**

“On the trusted-server path, Nutrient Data Extraction maps the PDF into a strict typed schema. The acceptance run recovered all six required demo fields. Here, each value stays attached to the provider's source block, page bounding box, match label, and relative confidence score. We call it a relative score, not a probability, and if the provider omits a score we do not turn that into zero.”

**Evidence to show:** Use the checked acceptance record or a pre-recorded response summary. Never show raw authenticated traffic.

## 0:55–1:25 — SerpApi discovery boundary

**Screen:** Official-domain search results and `discovered` status.

**Narration:**

“Next, SerpApi performs a narrow live Google Search against an explicit official-domain allowlist. The real acceptance query returned ten official-domain results. Search can reveal current guidance, but a title or snippet is not proof. Every result enters as discovered. It can affect approval only after a reviewer opens the official page and records the reviewed source digest.”

## 1:25–2:00 — Human review and blocking policy

**Screen:** Review an ambiguous field, show the unresolved terms, and show packet approval blocked.

**Narration:**

“The source says ‘Customer confirms receipt,’ but does not define the approval channel. ClauseTrace keeps both unresolved terms instead of smoothing them into a confident answer. A correction becomes an append-only review event; it never overwrites the original extraction. Missing citations and unresolved contradictions keep the case in needs-review, so the system cannot silently advance it.”

## 2:00–2:35 — Engineering controls and DWS packet

**Screen:** Engineering-control mapping, then the generated packet preview.

**Narration:**

“Accepted clauses map to engineering controls such as a 45-day compatibility window, notice timing, an approval owner, and a tested rollback within 30 minutes. Nutrient DWS Processor then builds the evidence packet. The live acceptance run produced a valid one-page PDF containing the synthetic notice and unresolved items. The packet records the decision boundary; it is not a legal conclusion.”

## 2:35–3:05 — Technical credibility

**Screen:** Repository structure, acceptance JSON, and passing verification output with no secrets.

**Narration:**

“The public React demo is a deterministic no-login dry run. Live provider routes stay in Express with server-only credentials and fail closed without them. The repository includes the redacted provider acceptance record, adapter contract tests, approval-policy tests, production-bundle checks, and a full Git-history secret scan. The current suite passes 33 tests.”

## 3:05–3:20 — Close

**Screen:** Public demo URL and repository URL.

**Narration:**

“ClauseTrace makes the risky gaps visible: extraction is not acceptance, search is not evidence, and a packet is not permission to migrate. The code, synthetic dry run, and acceptance evidence are public under Apache 2.0.”

## Recording checklist

- [ ] Keep the final cut between 2:00 and 4:00.
- [ ] Show the product functioning, not a slide-only pitch.
- [ ] Use browser zoom that keeps status labels and citations readable at 1080p.
- [ ] Show the synthetic notice in the first 20 seconds.
- [ ] Do not imply that the static demo itself performs live provider calls.
- [ ] Do not show `.env`, terminals containing environment values, raw headers, account dashboards, or provider request IDs.
- [ ] Do not add copyrighted music or third-party footage.
- [ ] Verify the public video from a logged-out browser before adding its URL to Devpost.
- [ ] Obtain the account owner's explicit confirmation before publishing the video.
