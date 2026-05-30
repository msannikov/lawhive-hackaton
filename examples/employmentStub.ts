/**
 * Proves the Playbook seam: a SECOND domain (employment termination) runs
 * through the same registry → normalize → assess path, with no change to the
 * orchestrator, providers or core types.
 *
 * We feed a stub raw extraction (what a VLM would return) instead of real
 * documents, so it runs offline.
 *
 * Run: node --experimental-strip-types examples/employmentStub.ts
 */

import { getPlaybook } from "../src/playbooks/registry.ts";
import type { CaseInput } from "../src/core/types.ts";
import { formatUK } from "../src/core/dates.ts";

const playbook = getPlaybook("employment_termination");

// What the VLM would have extracted from an employment contract + dismissal letter.
const rawExtraction = {
  employee: { name: "Alex Carter" },
  employer: { name: "Northway Limited" },
  employment: { startDate: "2021-09-01", endDate: "2025-11-30", jobTitle: "Sales Executive" },
  termination: { type: "dismissal", reasonGiven: "performance", noticeGiven: true },
  evidence: [
    { field: "employment.startDate", value: "2021-09-01", source: "contract.pdf, clause 1" },
    { field: "employment.endDate", value: "2025-11-30", source: "dismissal_letter.pdf" },
  ],
};

const input: CaseInput = {
  documents: [],
  domain: "employment_termination",
  context: { evaluationDate: "2026-01-05" },
};

const warnings: string[] = [];
const employmentCase = playbook.normalize(rawExtraction, input, warnings);
const assessment = playbook.assess(employmentCase);

console.log("=".repeat(72));
console.log("ASSESSMENT —", playbook.id, `(${playbook.label})`);
console.log("=".repeat(72));
console.log("\nBranch:", assessment.branchLabel, `(${assessment.branch})`);

console.log("\nDecision trace:");
for (const step of assessment.reasoning) console.log("  •", step);

console.log("\nKey dates:");
for (const [label, date] of Object.entries(assessment.keyDates)) {
  console.log(`  ${label.padEnd(24)} ${date}`);
}

console.log("\nToolset:");
for (const tool of assessment.tools) {
  console.log(`\n  [${tool.priority}] ${tool.title}  (${tool.category})`);
  console.log(`      Next action: ${tool.nextAction}`);
  console.log(`      Deadline:    ${formatUK(tool.deadline)}  — ${tool.deadlineBasis}`);
  if (tool.legalBasis) console.log(`      Legal basis: ${tool.legalBasis}`);
}
console.log();
