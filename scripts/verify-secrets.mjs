import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const checkedPdf = "output/pdf/synthetic-api-change-addendum.pdf";
const checkedPdfDigest = createHash("sha256")
  .update(readFileSync(checkedPdf))
  .digest("hex");

const secretPatterns = [
  /pdf_(?:live|test)_[A-Za-z0-9_-]{12,}/gi,
  /(?:NUTRIENT_API_KEY|NUTRIENT_EXTRACTION_API_KEY|SERPAPI_API_KEY)[ \t]*=[ \t]*[^\s+\r\n][^\r\n]*/gi,
  /\b[0-9a-f]{64}\b/gi,
];

function scrubAllowedEvidence(text) {
  return text
    .replaceAll(checkedPdfDigest, "[allowed-synthetic-pdf-digest]")
    .replace(/\bsha256:[0-9a-f]{64}\b/gi, "[allowed-explicit-sha256-digest]");
}

function matchedPattern(text) {
  const scrubbed = scrubAllowedEvidence(text);
  return secretPatterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(scrubbed);
  });
}

const candidates = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { encoding: "utf8" },
)
  .split(/\r?\n/)
  .filter(Boolean);

const violations = [];
if (candidates.includes(".env")) violations.push(".env is not ignored");
for (const file of candidates) {
  if (file.startsWith(".env") && file !== ".env.example") {
    violations.push(`unexpected environment file ${file}`);
  }
}

for (const file of candidates) {
  const extension = file.slice(file.lastIndexOf(".")).toLowerCase();
  if (!textExtensions.has(extension) || !existsSync(file)) continue;
  const text = readFileSync(file, "utf8");
  if (matchedPattern(text)) violations.push(`credential-shaped value in ${file}`);
}

const clientFiles = existsSync("dist")
  ? execFileSync("git", ["ls-files", "--others", "--ignored", "--exclude-standard", "dist"], {
      encoding: "utf8",
    })
      .split(/\r?\n/)
      .filter(Boolean)
  : [];
for (const file of clientFiles) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, "utf8");
  if (
    /NUTRIENT_API_KEY|NUTRIENT_EXTRACTION_API_KEY|SERPAPI_API_KEY|api_key/i.test(
      text,
    )
  ) {
    violations.push(`server credential identifier in client bundle ${file}`);
  }
}

const history = execFileSync(
  "git",
  ["log", "-p", "--all", "--no-ext-diff", "--text", "--"],
  { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
);
if (matchedPattern(history)) {
  violations.push("credential-shaped value in Git history");
}

if (violations.length > 0) {
  for (const violation of violations) console.error(`secret-check: ${violation}`);
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    checkedFiles: candidates.length,
    clientBundleFiles: clientFiles.length,
    gitHistoryChecked: true,
    explicitSha256DigestsAllowed: true,
  }),
);
