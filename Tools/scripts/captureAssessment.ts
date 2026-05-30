/**
 * Captures a serialisable assessment snapshot for the Remotion demo.
 *
 * Run from repo root:
 *   node --experimental-strip-types Tools/scripts/captureAssessment.ts
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCase } from "../../src/evaluateCase.ts";
import { MockProvider } from "../../src/extraction/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "..", "src", "data", "assessment.json");

const documents = [
  { name: "tenancy_agreement.pdf", kind: "pdf", mediaType: "application/pdf", base64: "" } as const,
  { name: "bank_statement_deposit_payment.pdf", kind: "pdf", mediaType: "application/pdf", base64: "" } as const,
  { name: "dps_search_result.png", kind: "image", mediaType: "image/png", base64: "" } as const,
  { name: "mydeposits_search_result.png", kind: "image", mediaType: "image/png", base64: "" } as const,
  { name: "tds_search_result.png", kind: "image", mediaType: "image/png", base64: "" } as const,
];

const assessment = await evaluateCase(
  {
    documents: [...documents],
    context: { evaluationDate: "2026-05-30", landlordResponse: "unknown" },
  },
  { provider: new MockProvider() },
);

const serialisable = {
  domain: assessment.domain,
  branch: assessment.branch,
  branchLabel: assessment.branchLabel,
  summary: assessment.summary,
  reasoning: assessment.reasoning,
  keyDates: assessment.keyDates,
  escalation: assessment.escalation,
  nextMove: assessment.nextMove
    ? {
        ...assessment.nextMove,
        deadline: assessment.nextMove.deadline.toISOString(),
      }
    : undefined,
  tools: assessment.tools.map((t) => ({
    ...t,
    deadline: t.deadline.toISOString(),
  })),
  extraction: assessment.extraction,
  documents: documents.map((d) => ({ name: d.name, kind: d.kind })),
  workflowSteps: [
    { id: "documents", label: "Documents", detail: "Unstructured PDFs & images from the tenant" },
    { id: "extract", label: "VLM extraction", detail: "Claude / Gemini pulls facts via playbook schema" },
    { id: "normalize", label: "Normalise", detail: "Validate + type into domain case" },
    { id: "assess", label: "Rules engine", detail: "Deterministic branch + toolset" },
  ],
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(serialisable, null, 2));
console.log(`Wrote ${outPath}`);
