/**
 * The Tools Arsenal: the full catalogue of tools the consumer can use, organised
 * by decision-tree branch. Each builder takes the case + computed key dates and
 * returns concrete {@link Tool}s — every one carrying a next action, a real
 * deadline date and the legal basis it rests on.
 */

import type { Tool } from "../../core/types.ts";
import type { UnfairTermsBranch, UnfairTermsCase } from "./case.ts";
import type { KeyDates } from "./keyDates.ts";
import { formatUK } from "../../core/dates.ts";

type ToolBuilder = (c: UnfairTermsCase, k: KeyDates) => Tool[];

const money = (n: number) => `£${n.toFixed(2)}`;

/**
 * Tool common to every branch: dispute the debt with the collector in writing
 * and require them to pause collection while it is investigated. Built first so
 * it always leads the arsenal (priority 1).
 */
function disputeTheDebt(c: UnfairTermsCase, k: KeyDates): Tool {
  return {
    id: "dispute-debt-collector",
    title: `Dispute the debt in writing with ${c.debt.collectorName}`,
    category: "letter",
    priority: 1,
    legalBasis:
      "FCA CONC 7.5/7.14 (a disputed debt must be paused while investigated); Consumer Rights Act 2015 s62",
    deadline: k.disputeCollectorSendBy,
    deadlineBasis: `Send promptly — within 7 days of evaluation (${formatUK(k.disputeCollectorSendBy)}).`,
    nextAction:
      `Write to ${c.debt.collectorName} formally disputing the ${money(c.debt.amount)} claimed. ` +
      `State that the underlying ${c.challengedTerm.type.replace(/_/g, " ")} term is unfair and ` +
      `not binding (Consumer Rights Act 2015 s62), so no enforceable debt exists. Require them to ` +
      `PAUSE all collection activity while the dispute is investigated (FCA CONC) and to confirm ` +
      `this in writing by ${formatUK(k.collectorPauseDeadline)}.`,
    documentTemplate: disputeLetterTemplate(c, k),
  };
}

/* ------------------------------------------------------------------ *
 * Branch A — UNFAIR_TERM_LIKELY
 * The lock-in / charge looks unfair or was not transparent. Assert the
 * term is non-binding, dispute the debt, then complain / small claim.
 * ------------------------------------------------------------------ */
const unfairTermLikely: ToolBuilder = (c, k) => [
  disputeTheDebt(c, k),
  {
    id: "letter-to-gym-unfair-term",
    title: `Write to ${c.business.name} asserting the term is unfair`,
    category: "letter",
    priority: 2,
    legalBasis:
      "Consumer Rights Act 2015 ss62–64 & Sch 2 (grey list); CMA guidance on gym contracts",
    deadline: k.letterToGymSendBy,
    deadlineBasis: `Send within 7 days of evaluation (${formatUK(k.letterToGymSendBy)}).`,
    nextAction:
      `Write to ${c.business.name} stating the ${c.challengedTerm.type.replace(/_/g, " ")} term ` +
      `causes a significant imbalance contrary to good faith and is therefore not binding ` +
      `(CRA 2015 s62), and that under CMA guidance it is unfair to hold you to it given your ` +
      `change of circumstances. Ask them to cancel the membership and withdraw the ${money(c.debt.amount)} ` +
      `claim by ${formatUK(k.gymResponseDeadline)}.`,
    documentTemplate: letterToGymTemplate(c, k),
  },
  {
    id: "complain-or-small-claim",
    title: "Escalate to a complaint, ADR or small claim",
    category: "court",
    priority: 3,
    legalBasis:
      "Consumer Rights Act 2015 s62; County Court small claims track; Limitation Act 1980 s5 (6 years)",
    deadline: k.limitationLongstop,
    deadlineBasis:
      `Escalate after the response window (${formatUK(k.gymResponseDeadline)}); a contract debt ` +
      `cannot be enforced after the 6-year limitation longstop (${formatUK(k.limitationLongstop)}).`,
    nextAction:
      `If ${c.business.name} does not withdraw the claim by ${formatUK(k.gymResponseDeadline)}, ` +
      `escalate: complain to the gym's trade body / any ADR scheme, report misleading collection to ` +
      `Trading Standards, and if sued, defend on the basis the term is unfair and non-binding ` +
      `(CRA 2015 s62). You may also bring a small claim for any sums already taken.`,
  },
];

/* ------------------------------------------------------------------ *
 * Branch B — AGGRESSIVE_COLLECTION
 * Collection conduct breaches FCA CONC. Dispute, then complain to the
 * firm, the FOS and the FCA.
 * ------------------------------------------------------------------ */
const aggressiveCollection: ToolBuilder = (c, k) => [
  disputeTheDebt(c, k),
  {
    id: "complain-to-collector-conc",
    title: `Complain to ${c.debt.collectorName} under FCA CONC`,
    category: "letter",
    priority: 2,
    legalBasis: "FCA CONC 7.3/7.9 (no aggressive, oppressive or misleading collection)",
    deadline: k.letterToGymSendBy,
    deadlineBasis: `Complain in the same window as the dispute (${formatUK(k.letterToGymSendBy)}).`,
    nextAction:
      `Send ${c.debt.collectorName} a formal complaint setting out the aggressive / misleading ` +
      `conduct (threats, pressure or misstating your legal position) and that it breaches FCA CONC. ` +
      `Demand they pause collection and respond within 8 weeks.`,
  },
  {
    id: "escalate-fos-fca",
    title: "Escalate to the Financial Ombudsman and report to the FCA",
    category: "adr",
    priority: 3,
    legalBasis: "Financial Ombudsman Service; FCA Principles for Businesses",
    deadline: k.escalateBy,
    deadlineBasis: `If conduct continues, escalate by ${formatUK(k.escalateBy)}.`,
    nextAction:
      "If the firm does not stop or its final response is unsatisfactory, refer the complaint to " +
      "the free Financial Ombudsman Service and report the conduct to the FCA. Keep a log of every " +
      "contact (date, time, channel, content).",
  },
];

/* ------------------------------------------------------------------ *
 * Branch C — ARGUABLE
 * The term may be enforceable. Dispute to pause collection, then
 * negotiate a reduced settlement rather than litigate.
 * ------------------------------------------------------------------ */
const arguable: ToolBuilder = (c, k) => {
  // A pragmatic opening offer: roughly the run-off to the end of the minimum
  // term is what the gym would chase; offering a fraction settles cheaply.
  const offer = Math.max(c.membership.monthlyFee, c.debt.amount * 0.3);
  return [
    disputeTheDebt(c, k),
    {
      id: "request-breakdown",
      title: `Request a breakdown of the ${money(c.debt.amount)} claimed`,
      category: "evidence",
      priority: 2,
      legalBasis: "Consumer Rights Act 2015 s62; pre-action information",
      deadline: k.letterToGymSendBy,
      deadlineBasis: `Ask early so you can evaluate the claim (${formatUK(k.letterToGymSendBy)}).`,
      nextAction:
        `Write to ${c.business.name} / ${c.debt.collectorName} asking for an itemised breakdown of ` +
        `the ${money(c.debt.amount)}: which months, what cancellation charge, and the contract term ` +
        `relied on. This lets you test whether the charge is proportionate (CRA 2015 Sch 2).`,
    },
    {
      id: "negotiate-settlement",
      title: "Negotiate a reduced full-and-final settlement",
      category: "negotiation",
      priority: 3,
      legalBasis: "Consumer Rights Act 2015 s62 (term remains arguable)",
      deadline: k.escalateBy,
      deadlineBasis: `Negotiate before any claim is issued (by ${formatUK(k.escalateBy)}).`,
      nextAction:
        `Offer a reduced full-and-final settlement (e.g. around ${money(offer)}) "without prejudice", ` +
        `noting the term's fairness is arguable and that litigation is disproportionate for both sides. ` +
        `Get any agreement in writing and confirmation the debt is closed and not reported to credit files.`,
    },
  ];
};

const BUILDERS: Record<UnfairTermsBranch, ToolBuilder> = {
  UNFAIR_TERM_LIKELY: unfairTermLikely,
  AGGRESSIVE_COLLECTION: aggressiveCollection,
  ARGUABLE: arguable,
};

/** Returns the matched, priority-ordered toolset for a branch. */
export function buildToolsForBranch(
  branch: UnfairTermsBranch,
  c: UnfairTermsCase,
  k: KeyDates,
): Tool[] {
  return BUILDERS[branch](c, k).sort((a, b) => a.priority - b.priority);
}

/**
 * Calibrated written dispute to the debt collector (Never Split the Difference
 * style). An information-gathering instrument, not boilerplate: it labels the
 * situation, disarms, asks calibrated "How/What" questions the collector must
 * answer to engage, sets a concrete pause deadline, and states the consumer's
 * legal position. The job of this letter is to GET A RESPONSE and to STOP the
 * clock on collection.
 */
function disputeLetterTemplate(c: UnfairTermsCase, k: KeyDates): string {
  const deadline = formatUK(k.collectorPauseDeadline);
  const amount = money(c.debt.amount);

  return [
    `Dear ${c.debt.collectorName},`,
    ``,
    `Re: Disputed debt — ${c.business.name} membership (${c.consumer.name})`,
    ``,
    `I am writing to formally DISPUTE the ${amount} you say I owe in connection with my ` +
      `${c.business.name} membership. I do not accept that any enforceable debt exists.`,
    ``,
    `The sum is based on a ${c.challengedTerm.type.replace(/_/g, " ")} term that I consider unfair ` +
      `under section 62 of the Consumer Rights Act 2015 — it causes a significant imbalance in the ` +
      `parties' rights, contrary to good faith — and is therefore not binding on me.`,
    ``,
    `I'd like to resolve this properly rather than have it escalate, so please help me understand:`,
    `  • How is this sum calculated, and which contract term are you relying on?`,
    `  • How can you continue collection while the underlying debt is genuinely disputed?`,
    ``,
    `While this dispute is unresolved, please PAUSE all collection activity, as required by the ` +
      `FCA's CONC rules, and confirm in writing that you have done so by ${deadline}.`,
    ``,
    `If collection continues, or I receive misleading or pressuring contact, I will complain to ` +
      `you formally, refer the matter to the Financial Ombudsman Service and report it to the FCA.`,
    ``,
    `Please reply by ${deadline}.`,
    ``,
    `Yours faithfully,`,
    c.consumer.name,
  ].join("\n");
}

/**
 * Calibrated letter to the gym asserting the term is unfair and non-binding.
 */
function letterToGymTemplate(c: UnfairTermsCase, k: KeyDates): string {
  const deadline = formatUK(k.gymResponseDeadline);
  const amount = money(c.debt.amount);
  const reason = c.cancellationReason.replace(/_/g, " ");

  return [
    `Dear ${c.business.name},`,
    ``,
    `Re: Cancellation of membership and withdrawal of the ${amount} claim (${c.consumer.name})`,
    ``,
    `I'm writing about the ${c.challengedTerm.type.replace(/_/g, " ")} term in my membership, which ` +
      `you are relying on to claim ${amount} from me (now via ${c.debt.collectorName}).`,
    ``,
    `I consider that term unfair and not binding on me under section 62 of the Consumer Rights Act ` +
      `2015: it causes a significant imbalance in our rights, contrary to good faith. The CMA's ` +
      `guidance on gym contracts says it is unfair to hold a member to a long lock-in or ` +
      `cancellation charge when their circumstances change` +
      (reason !== "unknown" ? ` — in my case, ${reason}.` : `.`),
    ``,
    `I'd genuinely rather sort this out with you directly. To help me understand your position:`,
    `  • How is the ${amount} justified given my change of circumstances?`,
    `  • What can we do to release me from a term that I don't believe is enforceable?`,
    ``,
    `Please confirm by ${deadline} that my membership is cancelled and the ${amount} claim is ` +
      `withdrawn. If we can't resolve it, I will treat the term as non-binding, defend any claim on ` +
      `that basis, and raise the matter with Trading Standards.`,
    ``,
    `Please reply by ${deadline}.`,
    ``,
    `Yours faithfully,`,
    c.consumer.name,
  ].join("\n");
}
