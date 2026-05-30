/**
 * End-to-end example: unstructured documents → VLM extraction → toolset.
 *
 * Run:
 *   npm run example                       # offline (Mock provider, no key)
 *   ANTHROPIC_API_KEY=... npm run example # real Claude VLM extraction
 *   GEMINI_API_KEY=...    npm run example # real Gemini VLM extraction
 *
 * Provider is auto-selected from the environment; force with EXTRACTION_PROVIDER.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { evaluateCase } from "../src/evaluateCase.ts";
import { loadDocumentsFromDir } from "../src/extraction/index.ts";
import { formatUK } from "../src/core/dates.ts";

const here = dirname(fileURLToPath(import.meta.url));
const data = join(here, "..", "sample_data");

// Accept whatever the user dropped into sample_data — any number of PDFs/images.
const documents = await loadDocumentsFromDir(data);
console.log(`Loaded ${documents.length} document(s):`);
for (const d of documents) console.log(`  - ${d.name} (${d.mediaType})`);
console.log();

// The user submits raw documents. `domain` picks the playbook (default deposit).
// Only non-document facts go in `context`.
const assessment = await evaluateCase({
  documents,
  domain: process.env.DOMAIN, // e.g. "employment_termination"; undefined → default
  context: { evaluationDate: "2026-05-30", landlordResponse: "unknown" },
});

console.log("=".repeat(72));
console.log("ASSESSMENT —", assessment.domain);
console.log("Extraction provider:", assessment.extraction.provider);
console.log("=".repeat(72));

console.log("\nBranch:", assessment.branchLabel, `(${assessment.branch})`);

console.log("\nExtracted facts (provenance):");
for (const e of assessment.extraction.evidence) {
  console.log(`  • ${e.field} = ${JSON.stringify(e.value)}  [${e.source}]`);
}
if (assessment.extraction.warnings.length) {
  console.log("\nExtraction warnings:");
  for (const w of assessment.extraction.warnings) console.log("  ! " + w);
}

console.log("\nDecision trace:");
for (const step of assessment.reasoning) console.log("  •", step);

console.log("\nKey dates:");
for (const [label, date] of Object.entries(assessment.keyDates)) {
  console.log(`  ${label.padEnd(32)} ${date}`);
}

console.log("\nToolset for the tenant:");
for (const tool of assessment.tools) {
  console.log(`\n  [${tool.priority}] ${tool.title}  (${tool.category})`);
  console.log(`      Next action: ${tool.nextAction}`);
  console.log(`      Deadline:    ${formatUK(tool.deadline)}  — ${tool.deadlineBasis}`);
  if (tool.legalBasis) console.log(`      Legal basis: ${tool.legalBasis}`);
}
console.log();
