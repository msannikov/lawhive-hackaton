/**
 * The Tools Arsenal: the full catalogue of tools the consumer can use under the
 * Consumer Rights Act 2015, organised by decision-tree branch. Each builder
 * takes the case + computed key dates and returns concrete {@link Tool}s — every
 * one carrying a next action and a real deadline date.
 */

import type { Tool } from "../../core/types.ts";
import type { FaultyGoodsBranch, FaultyGoodsCase } from "./case.ts";
import type { KeyDates } from "./keyDates.ts";
import { formatUK } from "../../core/dates.ts";

type ToolBuilder = (c: FaultyGoodsCase, k: KeyDates) => Tool[];

const money = (n: number) => `£${n.toFixed(2)}`;
const sellerContact = (c: FaultyGoodsCase) => c.seller.email ?? "by post and email";

/** Evidence-gathering tool, shared by every branch (always priority 1). */
function gatherEvidence(c: FaultyGoodsCase, k: KeyDates): Tool {
  return {
    id: "gather-evidence",
    title: "Assemble the evidence bundle",
    category: "evidence",
    priority: 1,
    legalBasis: "Consumer Rights Act 2015 ss9–11 (satisfactory quality, fit for purpose, as described)",
    deadline: k.notifyDealerBy,
    deadlineBasis: "Do first — the evidence underpins your written rejection/demand and any later claim.",
    nextAction:
      "Collect: (1) the purchase invoice showing " +
      `${money(c.purchase.amount)} paid to ${c.seller.name} on ${formatUK(k.purchaseDate)}; ` +
      `(2) the independent diagnostic report${
        c.fault.diagnosticFinding ? ` (finding: ${c.fault.diagnosticFinding})` : ""
      }; (3) the V5C/registration or proof of ownership; (4) all messages with the dealer.`,
  };
}

/* ------------------------------------------------------------------ *
 * Branch A — WITHIN_30_DAYS
 * Fault arose within 30 days of ownership → short-term right to reject
 * for a FULL refund. The window is the binding deadline.
 * ------------------------------------------------------------------ */
const within30Days: ToolBuilder = (c, k) => [
  gatherEvidence(c, k),
  {
    id: "exercise-short-term-reject",
    title: "Reject the goods in writing for a full refund",
    category: "letter",
    priority: 2,
    legalBasis: "Consumer Rights Act 2015 s20 & s22 (short-term right to reject)",
    deadline: k.rejectWindowEnd,
    deadlineBasis:
      `THE key deadline — the 30-day short-term right to reject expires ${formatUK(
        k.rejectWindowEnd,
      )} (CRA s22).`,
    nextAction:
      `Notify ${c.seller.name} (${sellerContact(c)}) IN WRITING, before ${formatUK(
        k.rejectWindowEnd,
      )}, that you reject the ${c.goods.description} under your short-term right to reject and require ` +
      `a FULL refund of ${money(c.purchase.amount)}. State the fault clearly and keep the goods available ` +
      "for collection. Do not agree to a repair if you want the full refund.",
    documentTemplate: rejectionLetterTemplate(c, k),
  },
  {
    id: "chase-refund-then-escalate",
    title: "Chase the refund, then escalate if refused",
    category: "chase",
    priority: 3,
    legalBasis: "Consumer Rights Act 2015 s20(15) (refund within 14 days, same payment method)",
    deadline: k.letterBeforeClaimResponseDeadline,
    deadlineBasis:
      `A s20 refund is due within 14 days of agreeing it; if unpaid, escalate by ${formatUK(
        k.letterBeforeClaimResponseDeadline,
      )}.`,
    nextAction:
      `If ${c.seller.name} ignores or refuses the rejection, send a Letter Before Claim and prepare to ` +
      "refer the dispute to the Motor Ombudsman or issue a small claim (see the refuses-path tools).",
  },
];

/* ------------------------------------------------------------------ *
 * Branch B — REPAIR_OR_REPLACE
 * After 30 days, first occurrence → require repair or replacement at no
 * cost within a reasonable time. If it fails, the final right to reject opens.
 * ------------------------------------------------------------------ */
const repairOrReplace: ToolBuilder = (c, k) => [
  gatherEvidence(c, k),
  {
    id: "require-repair-or-replace",
    title: "Require a free repair or replacement in writing",
    category: "letter",
    priority: 2,
    legalBasis: "Consumer Rights Act 2015 s23 (right to repair or replacement)",
    deadline: k.notifyDealerBy,
    deadlineBasis: `Put the trader on notice promptly (by ${formatUK(k.notifyDealerBy)}).`,
    nextAction:
      `Write to ${c.seller.name} (${sellerContact(c)}) requiring a repair OR replacement of the ` +
      `${c.goods.description} at no cost and within a reasonable time, under CRA 2015 s23. ` +
      (c.fault.diagnosticFinding
        ? `Attach the diagnostic finding (${c.fault.diagnosticFinding}). `
        : "") +
      "State that you reserve your right to a price reduction or final rejection if the repair fails.",
    documentTemplate: repairDemandTemplate(c, k),
  },
  {
    id: "final-right-to-reject-if-fails",
    title: "Reserve the final right to reject / price reduction",
    category: "negotiation",
    priority: 3,
    legalBasis: "Consumer Rights Act 2015 s24 (price reduction / final right to reject)",
    deadline: k.letterBeforeClaimResponseDeadline,
    deadlineBasis:
      "The trader gets ONE attempt; if the repair/replacement fails or is not done in a reasonable time, the s24 remedies open.",
    nextAction:
      "If the one repair or replacement does not fix the fault, do not accept a second attempt: claim a " +
      `price reduction or exercise the FINAL right to reject the ${c.goods.description} (a refund, which ` +
      "for goods kept over 6 months may be reduced for use). Then proceed to the Letter Before Claim.",
  },
];

/* ------------------------------------------------------------------ *
 * Branch C — FINAL_RIGHT_TO_REJECT
 * One repair already failed → price reduction or final right to reject.
 * ------------------------------------------------------------------ */
const finalRightToReject: ToolBuilder = (c, k) => [
  gatherEvidence(c, k),
  {
    id: "exercise-final-reject",
    title: "Exercise the final right to reject (or claim a price reduction)",
    category: "letter",
    priority: 2,
    legalBasis: "Consumer Rights Act 2015 s24 (final right to reject / price reduction)",
    deadline: k.notifyDealerBy,
    deadlineBasis: `Act promptly after the failed repair (by ${formatUK(k.notifyDealerBy)}).`,
    nextAction:
      `Write to ${c.seller.name} (${sellerContact(c)}) stating that, the repair having failed, you exercise ` +
      `your FINAL right to reject the ${c.goods.description} for a refund of ${money(c.purchase.amount)} ` +
      "under CRA 2015 s24, or alternatively require an appropriate price reduction. Note that any deduction " +
      "for use is limited and (for motor vehicles) cannot be made in the first 6 months.",
    documentTemplate: rejectionLetterTemplate(c, k),
  },
  {
    id: "letter-before-claim",
    title: "Send a Letter Before Claim",
    category: "letter",
    priority: 3,
    legalBasis: "Pre-Action Protocol for Debt Claims; Consumer Rights Act 2015 s24",
    deadline: k.letterBeforeClaimSendBy,
    deadlineBasis: `Send within 7 days of evaluation to keep momentum (${formatUK(k.letterBeforeClaimSendBy)}).`,
    nextAction:
      `If the refund is refused, send ${c.seller.name} a Letter Before Claim demanding ${money(
        c.purchase.amount,
      )} and giving 14 days to respond (by ${formatUK(k.letterBeforeClaimResponseDeadline)}).`,
    documentTemplate: letterBeforeClaimTemplate(c, k),
  },
  smallClaimTool(c, k, 4),
];

/* ------------------------------------------------------------------ *
 * Branch D — DEALER_REFUSES
 * Trader refuses / silent → Letter Before Claim, then Motor Ombudsman
 * ADR, otherwise County Court small claim.
 * ------------------------------------------------------------------ */
const dealerRefuses: ToolBuilder = (c, k) => [
  gatherEvidence(c, k),
  {
    id: "letter-before-claim",
    title: "Send a Letter Before Claim",
    category: "letter",
    priority: 2,
    legalBasis: "Pre-Action Protocol for Debt Claims; Consumer Rights Act 2015 ss20–24",
    deadline: k.letterBeforeClaimSendBy,
    deadlineBasis: `Send within 7 days of evaluation (${formatUK(k.letterBeforeClaimSendBy)}); give 14 days to respond.`,
    nextAction:
      `Send ${c.seller.name} (${sellerContact(c)}) a Letter Before Claim setting out the CRA 2015 breach, ` +
      `the remedy you require (refund of ${money(c.purchase.amount)} / repair / replacement) and giving ` +
      `14 days to respond by ${formatUK(k.letterBeforeClaimResponseDeadline)}, failing which you will refer ` +
      "the matter to the Motor Ombudsman or issue a court claim.",
    documentTemplate: letterBeforeClaimTemplate(c, k),
  },
  {
    id: "motor-ombudsman-adr",
    title: "Refer the dispute to the Motor Ombudsman (ADR)",
    category: "adr",
    priority: 3,
    legalBasis: "Alternative Dispute Resolution for Consumer Disputes Regulations 2015; Motor Ombudsman scheme",
    deadline: k.adrRaiseBy,
    deadlineBasis: `Refer promptly once the trader's process is exhausted (by ${formatUK(k.adrRaiseBy)}).`,
    nextAction:
      "If there is no satisfactory response to the Letter Before Claim, refer the dispute to the Motor " +
      "Ombudsman's free ADR service (if the dealer is accredited) and submit your evidence bundle. ADR is " +
      "cheaper and faster than court and does not stop you issuing a claim later.",
  },
  smallClaimTool(c, k, 4),
];

/** County Court small claim — the decision step (shared, parameterised priority). */
function smallClaimTool(c: FaultyGoodsCase, k: KeyDates, priority: number): Tool {
  return {
    id: "county-court-small-claim",
    title: "Issue a County Court small claim",
    category: "court",
    priority,
    legalBasis: "Consumer Rights Act 2015 ss19–24; County Court (small claims track, claims up to £10,000)",
    deadline: k.claimLimitationLongstop,
    deadlineBasis:
      `Issue after the LBC window expires and well before the 6-year limitation longstop (${formatUK(
        k.claimLimitationLongstop,
      )}).`,
    nextAction:
      `If the dealer still does not put it right, issue a County Court money claim (Money Claim Online) for ` +
      `${money(c.purchase.amount)} for breach of the CRA 2015 implied terms. The ${money(
        c.purchase.amount,
      )} value falls within the small claims track. Attach the evidence bundle.`,
  };
}

const BUILDERS: Record<FaultyGoodsBranch, ToolBuilder> = {
  WITHIN_30_DAYS: within30Days,
  REPAIR_OR_REPLACE: repairOrReplace,
  FINAL_RIGHT_TO_REJECT: finalRightToReject,
  DEALER_REFUSES: dealerRefuses,
};

/** Returns the matched, priority-ordered toolset for a branch. */
export function buildToolsForBranch(
  branch: FaultyGoodsBranch,
  c: FaultyGoodsCase,
  k: KeyDates,
): Tool[] {
  return BUILDERS[branch](c, k).sort((a, b) => a.priority - b.priority);
}

/* ------------------------------------------------------------------ *
 * Calibrated letter templates (Never Split the Difference style). Each is an
 * information-gathering instrument, not boilerplate: a label to name the
 * situation, a disarming line, calibrated "How/What" questions the trader must
 * answer to engage, a concrete deadline, and a compliant statement of the
 * statutory consequences. The job is to GET A RESPONSE.
 * ------------------------------------------------------------------ */

function letterHeader(c: FaultyGoodsCase, k: KeyDates): string[] {
  const item = c.goods.identifier
    ? `${c.goods.description} (${c.goods.identifier})`
    : c.goods.description;
  return [
    `Dear ${c.seller.name},`,
    ``,
    `Re: Faulty goods — ${item}, purchased ${formatUK(k.purchaseDate)} for ${money(c.purchase.amount)}`,
    ``,
    `I'm writing about the ${item} I bought from you on ${formatUK(k.purchaseDate)}. ` +
      `The goods are faulty: ${c.fault.description}.` +
      (c.fault.diagnosticFinding ? ` An independent inspection found: ${c.fault.diagnosticFinding}.` : ""),
    ``,
  ];
}

/** Short-term / final rejection letter (full refund). */
function rejectionLetterTemplate(c: FaultyGoodsCase, k: KeyDates): string {
  const final = !!(c.repairAttempted || c.dealerResponse === "repair_failed");
  const lines = letterHeader(c, k);

  if (final) {
    lines.push(
      `You have already attempted a repair, but the fault remains. Under section 24 of the Consumer ` +
        `Rights Act 2015 I am exercising my final right to reject the goods and require a refund of ` +
        `${money(c.purchase.amount)}.`,
    );
  } else {
    lines.push(
      `The goods are not of satisfactory quality and are not fit for purpose (sections 9–10, Consumer ` +
        `Rights Act 2015). As the fault arose within 30 days of purchase, I am exercising my short-term ` +
        `right to reject under sections 20 and 22 and require a full refund of ${money(c.purchase.amount)}.`,
    );
  }

  lines.push(
    ``,
    `I'd like to resolve this directly, without either of us going to court.`,
    ``,
    `To help us sort this out:`,
    `  • How would you like to arrange collection of the goods and return of my ${money(c.purchase.amount)}?`,
    `  • What do you need from me to process the refund to my original payment method?`,
    ``,
    `Please confirm the refund by ${formatUK(k.letterBeforeClaimResponseDeadline)}. A refund under the ` +
      `Consumer Rights Act must be made within 14 days, using the same payment method, with no deduction ` +
      `(no deduction for use applies to a motor vehicle in the first six months).`,
    ``,
    `If I don't hear from you, I'll refer the matter to the Motor Ombudsman and, if necessary, issue a ` +
      `County Court claim. I would much rather settle it directly with you.`,
    ``,
    `Yours sincerely,`,
    c.buyer.name,
  );
  return lines.join("\n");
}

/** Repair-or-replacement demand letter (s23). */
function repairDemandTemplate(c: FaultyGoodsCase, k: KeyDates): string {
  const lines = letterHeader(c, k);
  lines.push(
    `Under section 23 of the Consumer Rights Act 2015 I require you to repair or replace the goods at no ` +
      `cost to me and within a reasonable time. As the fault appeared within six months of purchase, it is ` +
      `presumed to have been present when I bought the goods.`,
    ``,
    `I'd like to get this put right without a dispute.`,
    ``,
    `So we're clear:`,
    `  • How soon can you carry out the repair or provide a replacement?`,
    `  • What will you do if the repair does not resolve the fault?`,
    ``,
    `Please confirm your proposed remedy by ${formatUK(k.letterBeforeClaimResponseDeadline)}. If the repair ` +
      `or replacement fails or is not completed in a reasonable time, I reserve my right to a price reduction ` +
      `or to reject the goods for a refund under section 24.`,
    ``,
    `Yours sincerely,`,
    c.buyer.name,
  );
  return lines.join("\n");
}

/** Letter Before Claim (pre-action). */
function letterBeforeClaimTemplate(c: FaultyGoodsCase, k: KeyDates): string {
  const lines = letterHeader(c, k);
  lines.push(
    `This is a Letter Before Claim. You are in breach of the Consumer Rights Act 2015 (sections 9–11) ` +
      `because the goods were not of satisfactory quality, fit for purpose or as described, and you have not ` +
      `provided the remedy I am entitled to.`,
    ``,
    `I would still prefer to resolve this without court proceedings.`,
    ``,
    `Please tell me:`,
    `  • What is preventing you from refunding or repairing the goods?`,
    `  • How can we resolve this in the next 14 days?`,
    ``,
    `To settle this now, please refund ${money(c.purchase.amount)} (or provide a satisfactory repair/` +
      `replacement) by ${formatUK(k.letterBeforeClaimResponseDeadline)}.`,
    ``,
    `If I do not receive a satisfactory response by that date, I will refer the dispute to the Motor ` +
      `Ombudsman and/or issue a County Court claim for ${money(c.purchase.amount)} plus interest and costs, ` +
      `without further notice. This letter complies with the Pre-Action Protocol; please keep it safe and ` +
      `respond in line with the Protocol.`,
    ``,
    `Yours sincerely,`,
    c.buyer.name,
  );
  return lines.join("\n");
}
