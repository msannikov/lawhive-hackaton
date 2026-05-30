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
const penaltyLow = depositFormatted;
const penaltyHigh = `£${(tenantCase.deposit.amount * 3).toFixed(2)}`;

const letterTool = assessment.tools.find((t) => t.id === "letter-before-action");
const courtTool = assessment.tools.find((t) => t.id === "county-court-claim-s214");

function serialiseAssessmentRound(
  label: string,
  stage: string,
  userReport: string,
  a: CaseAssessment,
) {
  return {
    kind: "assessment" as const,
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

const round2Assessment = await evaluateCase(
  { ...baseInput, context: { ...baseInput.context, stage: "post_letter" } },
  { provider, playbook },
);

const negotiationRounds = [
  serialiseAssessmentRound(
    "Round 1 — before any contact",
    "initial",
    "Jamie uploads documents. No letter sent yet.",
    assessment,
  ),
  {
    ...serialiseAssessmentRound(
      "Round 2 — landlord went silent",
      "post_letter",
      'Jamie reports: "I sent the Letter Before Action — no reply."',
      round2Assessment,
    ),
    // After silence, the gate flips — next step is lawyer handoff, not filing yet.
    nextMove: {
      toolId: "lawyer-handoff",
      title: "Consult a lawyer before filing",
      rationale:
        "The penalty multiplier is discretionary — a lawyer should issue the s214 claim, not self-serve court filing.",
      deadline: round2Assessment.nextMove?.deadline.toISOString() ?? new Date().toISOString(),
    },
  },
  {
    kind: "court_filing" as const,
    label: "Round 3 — filing the s214 claim",
    stage: "post_adr",
    branchLabel: round2Assessment.branchLabel,
    userReport: 'Jamie reports: "Lawyer reviewed the bundle — filing the County Court claim."',
    courtFiling: {
      deposit: depositFormatted,
      penaltyLow,
      penaltyHigh,
      lbaResponseDeadline: assessment.keyDates["Contractual return deadline"] ?? "20 June 2026",
      limitationLongstop: assessment.keyDates["s214 claim longstop (6 yrs)"] ?? "13 May 2030",
      legalBasis: courtTool?.legalBasis ?? "Housing Act 2004 s214",
      checklist: [
        "Signed tenancy agreement",
        "Bank statement showing deposit payment",
        "Blank prescribed-information fields (Schedule 1)",
        "DPS / mydeposits / TDS negative search screenshots",
        "Letter Before Action + proof of sending",
      ],
      nextAction: courtTool?.nextAction ?? "",
    },
  },
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
