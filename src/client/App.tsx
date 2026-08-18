import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Braces,
  Check,
  ChevronRight,
  CircleDot,
  ExternalLink,
  FileCheck2,
  FileSearch,
  Fingerprint,
  Globe2,
  History,
  LockKeyhole,
  RefreshCcw,
  SearchCheck,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  createFreshDemoCase,
  runDeterministicReview,
} from "../fixtures/demo-case.js";
import {
  createDraftPacket,
  evaluateApproval,
} from "../core/review-policy.js";
import type {
  ClauseTraceCase,
  ExtractedField,
  ReviewState,
} from "../shared/types.js";

const PACKET_TIME = "2026-08-18T16:05:00.000Z";

const stateLabels: Record<ReviewState, string> = {
  uploaded: "Uploaded",
  extracting: "Extracting",
  needs_review: "Needs review",
  extraction_failed: "Extraction failed",
  reviewed_with_open_items: "Open items",
  approved_for_packet: "Packet approved",
  packet_generated: "Draft packet",
  awaiting_seal_confirmation: "Awaiting seal",
  sealed: "Sealed",
  sealing_failed: "Seal failed",
};

function displayValue(field: ExtractedField): string {
  if (field.value === null) return "Not resolved";
  if (typeof field.value === "string") return field.value;
  if (typeof field.value === "number" || typeof field.value === "boolean") {
    return String(field.value);
  }
  return JSON.stringify(field.value);
}

function confidenceTone(confidence: number): "good" | "warn" | "bad" {
  if (confidence >= 0.9) return "good";
  if (confidence >= 0.8) return "warn";
  return "bad";
}

export function App() {
  const [caseRecord, setCaseRecord] = useState<ClauseTraceCase>(() =>
    createFreshDemoCase(),
  );
  const [selectedFieldId, setSelectedFieldId] = useState("field-window");

  const blockers = useMemo(() => evaluateApproval(caseRecord), [caseRecord]);
  const selectedField =
    caseRecord.fields.find((field) => field.id === selectedFieldId) ??
    caseRecord.fields[0];

  const reviewedFieldCount = new Set(
    caseRecord.reviewEvents
      .filter((event) => event.fieldId)
      .map((event) => event.fieldId),
  ).size;

  const runReview = () => {
    setCaseRecord((current) => runDeterministicReview(current));
  };

  const generatePacket = () => {
    setCaseRecord((current) => createDraftPacket(current, PACKET_TIME));
  };

  const reset = () => {
    setCaseRecord(createFreshDemoCase());
    setSelectedFieldId("field-window");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="ClauseTrace home">
          <span className="brand-mark">
            <Braces size={18} strokeWidth={2.2} />
          </span>
          <span>ClauseTrace</span>
        </a>
        <nav className="topnav" aria-label="Primary navigation">
          <a href="#evidence">Evidence</a>
          <a href="#sources">Sources</a>
          <a href="#controls">Controls</a>
          <a href="#packet">Packet</a>
        </nav>
        <div className="mode-pill">
          <LockKeyhole size={14} />
          Public dry run
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="pulse-dot" />
              Evidence before migration
            </div>
            <h1>Turn document clauses into reviewable engineering controls.</h1>
            <p>
              ClauseTrace keeps extraction citations, live-source discovery,
              human decisions, and proposed controls in one trace. Search
              snippets can discover evidence. They cannot become evidence by
              themselves.
            </p>
            <div className="hero-actions">
              <button className="primary-button" onClick={runReview}>
                <Sparkles size={17} />
                Run guided dry review
              </button>
              <a
                className="secondary-button"
                href={caseRecord.documentUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open synthetic PDF <ExternalLink size={15} />
              </a>
            </div>
          </div>

          <aside className="case-summary" aria-label="Case summary">
            <div className="case-summary-head">
              <span>Active review</span>
              <span className={`state-badge state-${caseRecord.state}`}>
                <CircleDot size={12} /> {stateLabels[caseRecord.state]}
              </span>
            </div>
            <div className="case-id">{caseRecord.id}</div>
            <h2>{caseRecord.title}</h2>
            <div className="case-route">
              <span>shipping_country</span>
              <ArrowRight size={15} />
              <strong>country_code</strong>
            </div>
            <div className="summary-grid">
              <div>
                <strong>{caseRecord.fields.length}</strong>
                <span>extracted fields</span>
              </div>
              <div>
                <strong>{caseRecord.discoveries.length}</strong>
                <span>discovered sources</span>
              </div>
              <div>
                <strong>{reviewedFieldCount}</strong>
                <span>reviewed fields</span>
              </div>
              <div>
                <strong>{blockers.length}</strong>
                <span>open blockers</span>
              </div>
            </div>
          </aside>
        </section>

        <section className="trust-strip" aria-label="Evidence boundaries">
          <div>
            <FileCheck2 size={17} />
            Page-level citations
          </div>
          <div>
            <SearchCheck size={17} />
            Discovery is not proof
          </div>
          <div>
            <History size={17} />
            Append-only review events
          </div>
          <div>
            <ShieldAlert size={17} />
            No production authorization
          </div>
        </section>

        <section className="workspace" id="evidence">
          <div className="section-heading">
            <div>
              <span className="section-kicker">01 / Cited extraction</span>
              <h2>Every value keeps its source boundary.</h2>
            </div>
            <span className="fixture-label">Checked synthetic fixture</span>
          </div>

          <div className="review-layout">
            <div className="field-list" role="list" aria-label="Extracted fields">
              {caseRecord.fields.map((field) => (
                <button
                  className={`field-row ${selectedField.id === field.id ? "selected" : ""}`}
                  key={field.id}
                  onClick={() => setSelectedFieldId(field.id)}
                  role="listitem"
                >
                  <span className={`confidence-dot ${confidenceTone(field.confidence)}`} />
                  <span className="field-copy">
                    <span className="field-label">{field.label}</span>
                    <strong>{displayValue(field)}</strong>
                  </span>
                  <span className={`confidence confidence-${confidenceTone(field.confidence)}`}>
                    {Math.round(field.confidence * 100)}%
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>

            <article className="evidence-card">
              <div className="evidence-card-head">
                <div>
                  <span>Selected field</span>
                  <h3>{selectedField.label}</h3>
                </div>
                <span className="source-chip">
                  {selectedField.provenance === "synthetic_fixture"
                    ? "Fixture shaped like DWS"
                    : "Nutrient DWS"}
                </span>
              </div>
              <div className="evidence-value">{displayValue(selectedField)}</div>
              <div className="citation-block">
                <div className="citation-label">
                  <BookOpenCheck size={15} />
                  Source citation
                </div>
                {selectedField.citations.length > 0 ? (
                  selectedField.citations.map((citation) => (
                    <div className="citation" key={`${selectedField.id}-${citation.page}`}>
                      <span>Page {citation.page}</span>
                      <blockquote>“{citation.quote}”</blockquote>
                      <code>
                        bounds {citation.bounds.left}, {citation.bounds.top},{" "}
                        {citation.bounds.right}, {citation.bounds.bottom}
                      </code>
                    </div>
                  ))
                ) : (
                  <div className="empty-citation">
                    No provider citation - approval is blocked.
                  </div>
                )}
              </div>
              <div className="evidence-rule">
                <Fingerprint size={16} />
                Extraction evidence stays immutable. Corrections are recorded as
                separate review events.
              </div>
            </article>
          </div>
        </section>

        <section className="sources-section" id="sources">
          <div className="section-heading">
            <div>
              <span className="section-kicker">02 / Current-source discovery</span>
              <h2>Search finds candidates. Review establishes evidence.</h2>
            </div>
            <span className="query-id">Search ID: fixture-search-ct-204</span>
          </div>

          <div className="source-grid">
            {caseRecord.discoveries.map((source) => (
              <article className="source-card" key={source.id}>
                <div className="source-rank">{source.rank}</div>
                <div className="source-body">
                  <div className="source-meta">
                    <span className={source.officialDomain ? "official" : "outside"}>
                      {source.officialDomain ? (
                        <BadgeCheck size={13} />
                      ) : (
                        <AlertTriangle size={13} />
                      )}
                      {source.officialDomain
                        ? "Allowlisted domain"
                        : "Outside allowlist"}
                    </span>
                    <span>{source.state.replaceAll("_", " ")}</span>
                  </div>
                  <h3>{source.title}</h3>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.url} <ExternalLink size={12} />
                  </a>
                  <p>{source.snippet}</p>
                  <div className="discovery-warning">
                    <Globe2 size={15} />
                    Snippet is discovery metadata, not verified clause evidence.
                  </div>
                  {source.sourceDigest && (
                    <code className="digest">{source.sourceDigest}</code>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="controls-section" id="controls">
          <div className="section-heading">
            <div>
              <span className="section-kicker">03 / Engineering mapping</span>
              <h2>Proposed controls remain reviewable and bounded.</h2>
            </div>
          </div>
          <div className="control-grid">
            {caseRecord.controls.map((control) => (
              <article className="control-card" key={control.id}>
                <div className="control-icon">
                  {control.status === "blocked" ? (
                    <AlertTriangle size={18} />
                  ) : (
                    <Check size={18} />
                  )}
                </div>
                <span>{control.category}</span>
                <h3>{control.title}</h3>
                <p>{control.description}</p>
                <div className={`control-status ${control.status}`}>
                  {control.status}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="packet-section" id="packet">
          <div className="packet-copy">
            <span className="section-kicker">04 / Evidence packet</span>
            <h2>Generate a truthful draft even when review stays open.</h2>
            <p>
              The dry-run packet lists extracted, accepted, corrected, proposed,
              and unresolved content separately. It cannot call Nutrient build or
              signing from this public client.
            </p>
            <div className="packet-actions">
              <button
                className="primary-button"
                onClick={generatePacket}
                disabled={Boolean(caseRecord.packet)}
              >
                <FileSearch size={17} />
                {caseRecord.packet ? "Draft packet generated" : "Generate draft packet"}
              </button>
              <button className="text-button" onClick={reset}>
                <RefreshCcw size={15} /> Reset dry run
              </button>
            </div>
          </div>

          <article className="packet-card">
            <div className="packet-card-head">
              <div className="packet-icon">
                <FileCheck2 size={21} />
              </div>
              <div>
                <span>Packet status</span>
                <h3>{caseRecord.packet ? "Draft generated" : "Not generated"}</h3>
              </div>
              <span className="not-sealed">Not sealed</span>
            </div>

            {caseRecord.packet ? (
              <div className="packet-details">
                <div>
                  <span>Accepted</span>
                  <strong>{caseRecord.packet.acceptedFieldIds.length}</strong>
                </div>
                <div>
                  <span>Corrected</span>
                  <strong>{caseRecord.packet.correctedFieldIds.length}</strong>
                </div>
                <div>
                  <span>Proposed controls</span>
                  <strong>{caseRecord.packet.proposedControlIds.length}</strong>
                </div>
                <div>
                  <span>Unresolved</span>
                  <strong>{caseRecord.packet.unresolvedItems.length}</strong>
                </div>
                <div className="packet-manifest">
                  <span>Search manifest</span>
                  <strong>
                    {caseRecord.packet.searchManifest.length} provider result records
                  </strong>
                </div>
              </div>
            ) : (
              <div className="packet-placeholder">
                <FileSearch size={30} />
                Run the guided review, then generate a deterministic draft.
              </div>
            )}

            <div className="seal-boundary">
              <LockKeyhole size={16} />
              Live sealing requires a trusted server and the exact separate phrase
              <code>SEAL {caseRecord.id}</code>.
            </div>
          </article>
        </section>

        <section className="open-items" aria-label="Open review items">
          <div className="open-items-head">
            <div>
              <ShieldAlert size={18} />
              <strong>{blockers.length} approval blockers</strong>
            </div>
            <span>Visible by design</span>
          </div>
          <div className="blocker-list">
            {blockers.slice(0, 5).map((blocker, index) => (
              <div key={`${blocker.code}-${blocker.fieldId ?? blocker.discoveryId ?? index}`}>
                <AlertTriangle size={14} />
                <span>{blocker.message}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer>
        <div>
          <span className="brand footer-brand">
            <span className="brand-mark">
              <Braces size={16} />
            </span>
            ClauseTrace
          </span>
          <p>Engineering evidence workflow - not legal advice.</p>
        </div>
        <div className="footer-boundary">
          <LockKeyhole size={15} />
          Synthetic data · no provider keys · no production writes
        </div>
      </footer>
    </div>
  );
}
