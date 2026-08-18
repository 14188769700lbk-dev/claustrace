import type { ClauseTraceCase, JsonValue } from "../shared/types.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderValue(value: JsonValue): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function renderSyntheticPacketHtml(caseFile: ClauseTraceCase): string {
  const fields = caseFile.fields
    .map(
      (field) => `
        <tr>
          <th>${escapeHtml(field.label)}</th>
          <td>${escapeHtml(renderValue(field.value))}</td>
          <td>${Math.round(field.confidence * 100)}%</td>
          <td>${field.citations.length}</td>
        </tr>`,
    )
    .join("");

  const discoveries = caseFile.discoveries
    .map(
      (item) => `
        <li>
          <strong>${escapeHtml(item.title)}</strong><br />
          <span>${escapeHtml(item.url)}</span><br />
          <em>State: ${escapeHtml(item.state)} — snippet is not verified evidence.</em>
        </li>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>ClauseTrace synthetic evidence snapshot</title>
    <style>
      @page { size: A4; margin: 20mm; }
      body { color: #13231e; font: 13px/1.45 Arial, sans-serif; }
      h1 { margin: 0 0 4px; font-size: 24px; }
      .notice { margin: 12px 0 18px; padding: 10px 12px; background: #f4eee2; border-left: 4px solid #c66a3a; }
      .meta { color: #4c625a; font-size: 11px; overflow-wrap: anywhere; }
      table { width: 100%; border-collapse: collapse; margin: 14px 0 18px; }
      th, td { border: 1px solid #cbd6d1; padding: 7px; text-align: left; vertical-align: top; }
      th { width: 25%; background: #edf3f0; }
      li { margin-bottom: 10px; }
      em { color: #9b4d2c; }
      footer { margin-top: 24px; border-top: 1px solid #cbd6d1; padding-top: 8px; color: #4c625a; font-size: 10px; }
    </style>
  </head>
  <body>
    <h1>ClauseTrace evidence snapshot</h1>
    <div class="meta">Case ${escapeHtml(caseFile.id)} · document digest ${escapeHtml(caseFile.documentDigest)}</div>
    <div class="notice"><strong>Synthetic hackathon demo.</strong> Fictional data, not legal advice, not a migration authorization, and not a sealed evidence packet.</div>
    <h2>${escapeHtml(caseFile.title)}</h2>
    <table>
      <thead><tr><th>Extracted field</th><th>Fixture value</th><th>Confidence</th><th>Citations</th></tr></thead>
      <tbody>${fields}</tbody>
    </table>
    <h2>Search discoveries awaiting human review</h2>
    <ol>${discoveries}</ol>
    <footer>Generated from ClauseTrace checked synthetic fixtures through the Nutrient DWS /build integration. Extraction coordinates remain fixture provenance until the separate /extract contract is verified.</footer>
  </body>
</html>`;
}
