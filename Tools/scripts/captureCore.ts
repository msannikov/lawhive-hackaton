/**
 * Shared snapshot builder for the Remotion demos. Runs the REAL engine
 * (evaluateCase) with whichever provider is passed, and serialises the result
 * into the shape the video consumes. Used by both the offline (Mock) and live
 * (Claude) capture scripts.
 */

import { evaluateCase } from "../../src/evaluateCase.ts";
import { getPlaybook } from "../../src/playbooks/registry.ts";
import type { DocumentInput, ExtractionProvider } from "../../src/core/types.ts";
import type { TenantCase } from "../../src/playbooks/depositReturn/case.ts";

export async function buildSnapshot(provider: ExtractionProvider, documents: DocumentInput[]) {
  const playbook = getPlaybook("deposit_return");
  const baseInput = {
    documents: [...documents],
    domain: "deposit_return" as const,
    context: { evaluationDate: "2026-05-30", landlordResponse: "unknown" as const },
  };

  // Round 1 — real extraction + assessment.
  const assessment = await evaluateCase(baseInput, { provider, playbook });
  const tenantCase = assessment.extractedCase as TenantCase;

  // Round 2 — same facts, advanced stage (no second extraction call).
  const round2 = playbook.assess({ ...tenantCase, negotiationStage: "post_letter" });

  const depositFormatted = `£${tenantCase.deposit.amount.toFixed(2)}`;
  const penaltyLow = depositFormatted;
  const penaltyHigh = `£${(tenantCase.deposit.amount * 3).toFixed(2)}`;

  const letterTool = assessment.tools.find((t) => t.id === "letter-before-action");
  const courtTool = assessment.tools.find((t) => t.id === "county-court-claim-s214");

  const serialiseRound = (label: string, stage: string, userReport: string, a: typeof assessment | typeof round2) => ({
    kind: "assessment" as const,
    label,
    stage,
    userReport,
    branchLabel: a.branchLabel,
    escalation: a.escalation,
    nextMove: a.nextMove ? { ...a.nextMove, deadline: a.nextMove.deadline.toISOString() } : undefined,
  });

  const negotiationRounds = [
    serialiseRound("Round 1 — before any contact", "initial", "Jamie uploads documents. No letter sent yet.", assessment),
    {
      ...serialiseRound(
        "Round 2 — the landlord replies",
        "post_letter",
        'Jamie forwards the landlord\'s WhatsApp reply: "I\'ll return the deposit but I\'m not paying a penalty."',
        round2,
      ),
      // After silence the gate flips — next step is lawyer handoff, not filing yet.
      nextMove: {
        toolId: "lawyer-handoff",
        title: "Consult a lawyer before filing",
        rationale:
          "The penalty multiplier is discretionary — a lawyer should issue the s214 claim, not self-serve court filing.",
        deadline: round2.nextMove?.deadline.toISOString() ?? new Date().toISOString(),
      },
    },
    {
      kind: "court_filing" as const,
      label: "Round 3 — filing the s214 claim",
      stage: "post_adr",
      branchLabel: round2.branchLabel,
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

  return {
    brand: {
      product: "Law Gun",
      title: "Tenancy Deposit Return",
      subtitle: `Your landlord never protected ${depositFormatted}. Law Gun reads your tenancy papers, drafts your Letter Before Action, and re-assesses when you report back.`,
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
    channels: {
      supported: ["WhatsApp", "Email", "Voice note", "Photo of a letter"],
      inbound: {
        channel: "WhatsApp",
        from: `${tenantCase.landlord.name.replace(/^Mr\s+/, "")} (landlord)`,
        time: "2 days later",
        text: "Look Jamie, you're right that I never put it in a scheme. I'll send the £980.77 back but I'm not paying any penalty on top.",
      },
      reading: [
        "The landlord admits the deposit was never protected — that strengthens your claim.",
        "He offers the £980.77 back, but refuses the penalty.",
        "'Deposit only' is not full settlement — the 1–3× penalty is still yours to claim.",
      ],
      updatedStatus: "escalate",
      updatedLine: "Plan updated: don't accept deposit-only as final. This is where a lawyer adds weight on the penalty.",
    },
    negotiationRounds,
    domain: assessment.domain,
    branch: assessment.branch,
    branchLabel: assessment.branchLabel,
    summary: assessment.summary,
    reasoning: assessment.reasoning,
    keyDates: assessment.keyDates,
    escalation: assessment.escalation,
    nextMove: assessment.nextMove
      ? { ...assessment.nextMove, deadline: assessment.nextMove.deadline.toISOString() }
      : undefined,
    tools: assessment.tools.map((t) => ({ ...t, deadline: t.deadline.toISOString() })),
    extraction: assessment.extraction,
    documents: documents.map((d) => ({ name: d.name, kind: d.kind })),
    workflowSteps: [
      { id: "documents", label: "Your evidence", detail: "Tenancy agreement, bank proof & scheme searches" },
      { id: "extract", label: "Read the docs", detail: "Extract deposit amount, dates & protection status" },
      { id: "normalize", label: "Check the law", detail: "30-day rule, scheme searches, prescribed info" },
      { id: "assess", label: "Action plan", detail: "Branch, deadlines, letter & negotiation loop" },
    ],
  };
}
