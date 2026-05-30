/**
 * The Tools Arsenal: the full catalogue of tools the employee can use,
 * organised by decision-tree branch. Each builder takes the case + computed key
 * dates and returns concrete {@link Tool}s — every one carrying a next action,
 * a real deadline date, and (where relevant) the legal basis.
 *
 * The spine of every contentious branch is the same statutory route: raise a
 * grievance (ACAS Code) → mandatory ACAS Early Conciliation → Employment
 * Tribunal claim under s23 ERA 1996, all governed by the ET limit of 3 months
 * less 1 day from the deduction. ET claims carry no issue fee.
 */

import type { Tool } from "../../core/types.ts";
import type { UnpaidWagesBranch, UnpaidWagesCase } from "./case.ts";
import type { KeyDates } from "./keyDates.ts";
import { formatUK } from "../../core/dates.ts";

type ToolBuilder = (c: UnpaidWagesCase, k: KeyDates) => Tool[];

const money = (n: number) => `£${n.toFixed(2)}`;

/** Shared tool: start ACAS Early Conciliation (mandatory, before the ET limit). */
function acasTool(c: UnpaidWagesCase, k: KeyDates, priority: number): Tool {
  return {
    id: "acas-early-conciliation",
    title: "Start ACAS Early Conciliation",
    category: "adr",
    priority,
    legalBasis: "Employment Tribunals Act 1996 s18A; ERA 1996 s207B (clock pause)",
    deadline: k.acasStartBy,
    deadlineBasis:
      `Mandatory before any tribunal claim, and must be started before the ET limit of ` +
      `${formatUK(k.etClaimLimit)} (deduction + 3 months − 1 day). Notify ACAS by ` +
      `${formatUK(k.acasStartBy)} to leave room — it is free and pauses the clock while it runs.`,
    nextAction:
      "Notify ACAS to begin Early Conciliation against " +
      `${c.employer.name}. This free, mandatory step pauses the tribunal clock and gives a ` +
      "conciliator a chance to settle the unpaid wages without a hearing.",
  };
}

/** Shared tool: lodge the ET1 claim for unauthorised deductions. */
function et1Tool(c: UnpaidWagesCase, k: KeyDates, priority: number): Tool {
  return {
    id: "lodge-et1-unlawful-deduction",
    title: "Lodge an Employment Tribunal claim (ET1)",
    category: "court",
    priority,
    legalBasis: "Employment Rights Act 1996 ss13 & 23 (unauthorised deduction from wages)",
    deadline: k.etClaimLimit,
    deadlineBasis:
      `THE hard deadline: ${formatUK(k.etClaimLimit)} = deduction (${formatUK(k.deductionDate)}) ` +
      "+ 3 months − 1 day (extended by the ACAS Early Conciliation pause). Miss it and the claim is time-barred.",
    nextAction:
      `After the ACAS EC certificate is issued, lodge an ET1 claim for ${money(c.amountUnpaid)} ` +
      "in unpaid wages as an unauthorised deduction under s13 ERA 1996. There is no issue fee for " +
      "an Employment Tribunal claim. A County Court breach-of-contract claim is an alternative for " +
      "the pure contract sums (e.g. the commission).",
  };
}

/* ------------------------------------------------------------------ *
 * Branch A — UNLAWFUL_DEDUCTION
 * A clear contractual sum was withheld (salary / confirmed commission /
 * holiday) and the employer is silent. Grievance → ACAS EC → ET.
 * ------------------------------------------------------------------ */
const unlawfulDeduction: ToolBuilder = (c, k) => [
  {
    id: "gather-evidence",
    title: "Assemble the evidence bundle",
    category: "evidence",
    priority: 1,
    legalBasis: "ERA 1996 ss13, 27 (definition of wages); contract of employment",
    deadline: k.grievanceRaiseBy,
    deadlineBasis: "Do first — the bundle underpins the grievance and any tribunal claim.",
    nextAction:
      "Collect: (1) the signed employment contract and commission-scheme rules; " +
      (c.commission.claimed
        ? `(2) the written confirmation of the ${money(c.commission.amount ?? 0)} commission` +
          (c.commission.confirmedBy ? ` from ${c.commission.confirmedBy}` : "") +
          (c.commission.confirmedDate ? ` dated ${formatUK(new Date(c.commission.confirmedDate))}` : "") +
          "; "
        : "") +
      `(3) proof the ${money(c.amountUnpaid)} was due on ${formatUK(k.deductionDate)} and not paid ` +
      "(bank statement, missing payslip); (4) all the chasing emails to HR and any replies.",
  },
  {
    id: "raise-grievance",
    title: "Raise a formal written grievance",
    category: "letter",
    priority: 2,
    legalBasis: "ACAS Code of Practice on Disciplinary and Grievance Procedures",
    deadline: k.grievanceRaiseBy,
    deadlineBasis: `Raise promptly (by ${formatUK(k.grievanceRaiseBy)}) — before the tribunal window tightens.`,
    nextAction:
      `Write to ${c.employer.name} headed "Formal Grievance" setting out the ${money(c.amountUnpaid)} ` +
      "of unpaid wages, that withholding them is an unauthorised deduction under s13 ERA 1996, and " +
      "the outcome you want (payment in full). Following the ACAS Code can increase a tribunal award.",
    documentTemplate: demandLetterTemplate(c, k),
  },
  acasTool(c, k, 3),
  et1Tool(c, k, 4),
];

/* ------------------------------------------------------------------ *
 * Branch B — DISPUTED_COMMISSION
 * Employer disputes the entitlement (typically the commission). Build the
 * contract/scheme + written-confirmation evidence, then ACAS EC → ET.
 * ------------------------------------------------------------------ */
const disputedCommission: ToolBuilder = (c, k) => [
  {
    id: "assemble-commission-evidence",
    title: "Assemble contract & commission evidence",
    category: "evidence",
    priority: 1,
    legalBasis: "ERA 1996 ss13, 27; commission-scheme rules; contract of employment",
    deadline: k.grievanceRaiseBy,
    deadlineBasis: "Do first — entitlement must be evidenced before the dispute can be resolved.",
    nextAction:
      "Pull together the commission-scheme rules from the contract and the written confirmation " +
      `that the ${money(c.commission.amount ?? 0)} was payable` +
      (c.commission.confirmedBy ? ` (from ${c.commission.confirmedBy}` : "") +
      (c.commission.confirmedDate ? `, dated ${formatUK(new Date(c.commission.confirmedDate))})` : c.commission.confirmedBy ? ")" : "") +
      ". A discretion clause does not bite once a sum has been confirmed in writing as payable.",
  },
  {
    id: "request-written-reasons",
    title: "Request the employer's reasons in writing",
    category: "negotiation",
    priority: 2,
    legalBasis: "Pre-claim correspondence; ACAS Code",
    deadline: k.demandSendBy,
    deadlineBasis: `Ask early (by ${formatUK(k.demandSendBy)}) so you can evaluate the dispute.`,
    nextAction:
      "Write to the employer asking precisely why the commission is said not to be payable, and on " +
      "which contractual provision they rely. Their answer is the information your claim will turn on.",
  },
  {
    id: "raise-grievance",
    title: "Raise a formal written grievance",
    category: "letter",
    priority: 3,
    legalBasis: "ACAS Code of Practice on Disciplinary and Grievance Procedures",
    deadline: k.grievanceRaiseBy,
    deadlineBasis: `Raise promptly (by ${formatUK(k.grievanceRaiseBy)}) alongside seeking reasons.`,
    nextAction:
      `Raise a formal grievance with ${c.employer.name} asserting the commission was confirmed and ` +
      "is payable as wages under s13 ERA 1996, and requesting payment in full.",
    documentTemplate: demandLetterTemplate(c, k),
  },
  acasTool(c, k, 4),
  et1Tool(c, k, 5),
];

/* ------------------------------------------------------------------ *
 * Branch C — EMPLOYER_ENGAGING
 * Employer is engaging / has agreed. Pin the agreement down and keep the
 * ACAS/ET deadline protected as a fallback.
 * ------------------------------------------------------------------ */
const employerEngaging: ToolBuilder = (c, k) => [
  {
    id: "confirm-settlement-in-writing",
    title: "Confirm the agreed sum and payment date in writing",
    category: "negotiation",
    priority: 1,
    legalBasis: "Contract of employment; ERA 1996 s13",
    deadline: k.demandSendBy,
    deadlineBasis: `Get it in writing promptly (by ${formatUK(k.demandSendBy)}) while goodwill holds.`,
    nextAction:
      `Reply confirming the agreed figure (${money(c.amountUnpaid)}) and a specific payment date, ` +
      "and your bank details. Keep the written trail in case the payment does not arrive.",
  },
  {
    id: "diary-acas-deadline",
    title: "Diary the ACAS / ET deadline as a fallback",
    category: "verify",
    priority: 2,
    legalBasis: "ERA 1996 s23; Employment Tribunals Act 1996 s18A",
    deadline: k.acasStartBy,
    deadlineBasis:
      `Even while negotiating, protect the limit: the ET claim must start by ${formatUK(k.etClaimLimit)}. ` +
      `If unpaid, start ACAS Early Conciliation by ${formatUK(k.acasStartBy)}.`,
    nextAction:
      `If the agreed payment is not received, start ACAS Early Conciliation immediately and before ` +
      `${formatUK(k.acasStartBy)} so the tribunal route stays open.`,
  },
  acasTool(c, k, 3),
];

const BUILDERS: Record<UnpaidWagesBranch, ToolBuilder> = {
  UNLAWFUL_DEDUCTION: unlawfulDeduction,
  DISPUTED_COMMISSION: disputedCommission,
  EMPLOYER_ENGAGING: employerEngaging,
};

/** Returns the matched, priority-ordered toolset for a branch. */
export function buildToolsForBranch(
  branch: UnpaidWagesBranch,
  c: UnpaidWagesCase,
  k: KeyDates,
): Tool[] {
  return BUILDERS[branch](c, k).sort((a, b) => a.priority - b.priority);
}

/**
 * Calibrated demand / grievance letter (Never Split the Difference style). It is
 * an information-gathering instrument, not boilerplate: a label to name the
 * situation, a disarming line, calibrated "How/What" questions the employer must
 * answer to engage, a concrete deadline, and a compliant statement of
 * consequences. The job of this letter is to GET A RESPONSE — that response is
 * the information the next round depends on.
 */
function demandLetterTemplate(c: UnpaidWagesCase, k: KeyDates): string {
  const deadline = formatUK(k.demandResponseDeadline);
  const total = money(c.amountUnpaid);
  const commissionConfirmed = c.commission.claimed && c.commission.confirmedInWriting;

  const lines = [
    `Dear ${c.employer.name},`,
    ``,
    `Re: Formal grievance — unpaid wages (${total})`,
    ``,
    `I'm writing about ${total} in wages that fell due on ${formatUK(k.deductionDate)} and which ` +
      `has still not been paid. The sums I say are owed are:`,
    ``,
    ...c.unpaidItems.map((it) => `  • ${it.label}: ${money(it.amount)} (gross)`),
    ``,
  ];

  if (commissionConfirmed) {
    lines.push(
      `The commission element was confirmed in writing as payable` +
        (c.commission.confirmedBy ? ` by ${c.commission.confirmedBy}` : "") +
        (c.commission.confirmedDate ? ` on ${formatUK(new Date(c.commission.confirmedDate))}` : "") +
        `, so it has become payable and forms part of my wages.`,
    );
    lines.push(``);
  }

  lines.push(
    // Disarming / accusation audit.
    `I'd genuinely like to resolve this directly, without either of us going to a tribunal.`,
    ``,
    // Calibrated questions — these require a reply (= information).
    `To help me understand where things stand:`,
    `  • How am I supposed to manage when wages I've earned haven't been paid?`,
    `  • What is preventing payment, and what can we do to put this right between us?`,
    ``,
    `To settle this now, please pay the full ${total} to me by ${deadline}.`,
    ``,
    `Withholding wages that are properly payable is an unauthorised deduction under section 13 of ` +
      `the Employment Rights Act 1996. If I don't hear from you, I'll have little choice but to ` +
      `start ACAS Early Conciliation and bring an Employment Tribunal claim under section 23 — for ` +
      `which there is no issue fee — but I would much rather settle it directly with you.`,
    ``,
    `Please reply by ${deadline} so we can sort this out.`,
    ``,
    `Yours sincerely,`,
    c.employee.name,
  );

  return lines.join("\n");
}
