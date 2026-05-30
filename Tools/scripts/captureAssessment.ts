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
import { getPlaybook } from "../../src/playbooks/registry.ts";
import type { CaseAssessment } from "../../src/core/types.ts";
import type { TenantCase } from "../../src/playbooks/depositReturn/case.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "..", "src", "data", "assessment.json");

const documents = [
  { name: "tenancy_agreement.pdf", kind: "pdf", mediaType: "application/pdf", base64: "" } as const,
  { name: "bank_statement_deposit_payment.pdf", kind: "pdf", mediaType: "application/pdf", base64: "" } as const,
  { name: "dps_search_result.png", kind: "image", mediaType: "image/png", base64: "" } as const,
  { name: "mydeposits_search_result.png", kind: "image", mediaType: "image/png", base64: "" } as const,
  { name: "tds_search_result.png", kind: "image", mediaType: "image/png", base64: "" } as const,
];

const playbook = getPlaybook("deposit_return");
const provider = new MockProvider();

const baseInput = {
  documents: [...documents],
  domain: "deposit_return" as const,
  context: { evaluationDate: "2026-05-30", landlordResponse: "unknown" as const },
};

const assessment = await evaluateCase(baseInput, { provider, playbook });

const tenantCase = assessment.extractedCase as TenantCase;
const depositFormatted = `£${tenantCase.deposit.amount.toFixed(2)}`;

const letterTool = assessment.tools.find((t) => t.id === "letter-before-action");

function serialiseRound(label: string, stage: string, userReport: string, a: CaseAssessment) {
  return {
    label,
    stage,
    userReport,
    branchLabel: a.branchLabel,
    escalation: a.escalation,
    nextMove: a.nextMove
      ? { ...a.nextMove, deadline: a.nextMove.deadline.toISOString() }
      : undefined,
  };
}

const negotiationRounds = [
  serialiseRound(
    "Round 1 — before any contact",
    "initial",
    "Jamie uploads documents. No letter sent yet.",
    assessment,
  ),
  serialiseRound(
    "Round 2 — landlord went silent",
    "post_letter",
    'Jamie reports: "I sent the Letter Before Action — no reply."',
    await evaluateCase(
      { ...baseInput, context: { ...baseInput.context, stage: "post_letter" } },
      { provider, playbook },
    ),
  ),
];

const serialisable = {
  brand: {
    product: "Law Gun",
    title: "Tenancy Deposit Return",
    subtitle:
      `Your landlord never protected ${depositFormatted}. Law Gun reads your tenancy papers, drafts your Letter Before Action, and re-assesses when you report back.`,
  },
  caseMeta: {
    tenantName: tenantCase.tenant.name,
    landlordName: tenantCase.landlord.name,
    propertyAddress: tenantCase.property.address,
    depositAmount: tenantCase.deposit.amount,
    depositFormatted,
    problem: "Deposit not found in DPS, mydeposits or TDS",
    playbookLabel: playbook.label,
  },
  letterTemplate: letterTool?.documentTemplate ?? "",
  negotiationRounds,
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
    { id: "documents", label: "Your evidence", detail: "Tenancy agreement, bank proof & scheme searches" },
    { id: "extract", label: "Read the docs", detail: "Extract deposit amount, dates & protection status" },
    { id: "normalize", label: "Check the law", detail: "30-day rule, scheme searches, prescribed info" },
    { id: "assess", label: "Action plan", detail: "Branch, deadlines, letter & negotiation loop" },
  ],
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(serialisable, null, 2));
console.log(`Wrote ${outPath}`);
