/**
 * The Tools Arsenal: the full catalogue of tools the customer can use, organised
 * by decision-tree branch. Each builder takes the case + computed key dates and
 * returns concrete {@link Tool}s — every one carrying a next action and a real
 * deadline date.
 */

import type { Tool } from "../../core/types.ts";
import type { BuildingDisputeBranch, BuildingDisputeCase } from "./case.ts";
import {
  type KeyDates,
  recoverableLoss,
  totalPaid,
  totalRemedialCost,
} from "./keyDates.ts";
import { formatUK } from "../../core/dates.ts";

type ToolBuilder = (c: BuildingDisputeCase, k: KeyDates) => Tool[];

const money = (n: number) => `£${n.toFixed(2)}`;

/** The statutory basis differs for a consumer vs a business customer. */
function liabilityBasis(c: BuildingDisputeCase): string {
  return c.customerType === "consumer"
    ? "Consumer Rights Act 2015 ss49 & 52 (reasonable care, skill and time); breach of contract"
    : "Breach of contract (failure to complete / defective performance)";
}

/* ------------------------------------------------------------------ *
 * Shared tools — every branch needs the loss quantified, an LBC, and a
 * route to the County Court. The threatening branch adds two more.
 * ------------------------------------------------------------------ */

function quantifyLossTool(c: BuildingDisputeCase, k: KeyDates): Tool {
  const remedial = totalRemedialCost(c);
  const sources = c.remedialCosts.map((r) => `${r.source} (${r.kind}, ${money(r.amount)})`).join("; ");
  return {
    id: "quantify-loss",
    title: "Assemble the evidence and quantify the loss",
    category: "evidence",
    priority: 1,
    legalBasis: liabilityBasis(c),
    deadline: k.quantifyLossBy,
    deadlineBasis: "Do first — the loss underpins the demand and any claim (evaluation + 7 days).",
    nextAction:
      "Collect: (1) the original quote/contract and the agreed scope of works; " +
      `(2) bank-transfer confirmations for the ${money(totalPaid(c))} paid to ` +
      `${c.contractor.name}; (3) dated photos of the incomplete/defective work; ` +
      `(4) the remedial/completion quote(s) and invoice(s) evidencing the loss` +
      (sources ? ` — ${sources}` : "") +
      `; (5) all messages with the contractor. ` +
      `The reasonable cost of completing/remedying the work is ${money(remedial)}` +
      (c.contract.agreedPrice != null
        ? `, giving a net recoverable loss of about ${money(recoverableLoss(c))} after credit for ` +
          `any unpaid balance of the agreed ${money(c.contract.agreedPrice)} price.`
        : "."),
  };
}

function letterBeforeClaimTool(c: BuildingDisputeCase, k: KeyDates, firm: boolean): Tool {
  return {
    id: "letter-before-claim",
    title: firm ? "Send a firm Letter Before Claim" : "Send a Letter Before Claim",
    category: "letter",
    priority: 2,
    legalBasis:
      "Pre-Action Protocol for Construction & Engineering Disputes; " + liabilityBasis(c),
    deadline: k.letterBeforeClaimSendBy,
    deadlineBasis: `Send within 7 days of evaluation (${formatUK(k.letterBeforeClaimSendBy)}) to keep momentum.`,
    nextAction:
      `Send ${c.contractor.name} (${c.contractor.email ?? "by post and email"}) a Letter Before ` +
      `Claim setting out the breach, demanding completion of the works OR payment of the ` +
      `${money(recoverableLoss(c))} reasonable cost of completing/remedying them, and giving ` +
      `14 days to respond (by ${formatUK(k.letterBeforeClaimResponseDeadline)}). ` +
      (firm
        ? "Keep it factual and firm; do not engage with the abuse. State that further threatening " +
          "contact will be reported."
        : "Invite a without-prejudice discussion to settle."),
    documentTemplate: letterBeforeClaimTemplate(c, k, firm),
  };
}

function countyCourtTool(c: BuildingDisputeCase, k: KeyDates): Tool {
  const loss = recoverableLoss(c);
  const track =
    loss < 10000
      ? "the small claims track (claims under £10,000)"
      : "the fast/intermediate or multi-track (claims of £10,000 or more)";
  return {
    id: "county-court-claim",
    title: "Issue a County Court claim for the remedial cost",
    category: "court",
    priority: 3,
    legalBasis: liabilityBasis(c) + "; County Court money claim",
    deadline: k.claimLimitationLongstop,
    deadlineBasis:
      `Issue after the LBC window expires (from ${formatUK(k.issueClaimBy)}) and well before the ` +
      `6-year limitation longstop (${formatUK(k.claimLimitationLongstop)}).`,
    nextAction:
      `If ${c.contractor.name} does not put matters right by ` +
      `${formatUK(k.letterBeforeClaimResponseDeadline)}, issue a County Court money claim ` +
      `(via Money Claim Online) for ${money(loss)} as the reasonable cost of completing/remedying ` +
      `the work, plus interest and the court fee. This would proceed on ${track}. ` +
      "Attach the evidence bundle and the remedial quote/invoice.",
  };
}

/* ------------------------------------------------------------------ *
 * Branch A — INCOMPLETE_OR_DEFECTIVE
 * Work abandoned/substandard, no useful response. Quantify, demand
 * completion or remedial costs, LBC, then County Court.
 * ------------------------------------------------------------------ */
const incompleteOrDefective: ToolBuilder = (c, k) => [
  quantifyLossTool(c, k),
  letterBeforeClaimTool(c, k, false),
  countyCourtTool(c, k),
];

/* ------------------------------------------------------------------ *
 * Branch B — CONTRACTOR_THREATENING
 * Abuse / intimidation. Preserve everything, send a firm LBC, consider
 * reporting, then the same County Court route.
 * ------------------------------------------------------------------ */
const contractorThreatening: ToolBuilder = (c, k) => [
  {
    id: "preserve-and-report-conduct",
    title: "Preserve the threatening messages and consider reporting",
    category: "evidence",
    priority: 1,
    legalBasis: "Protection from Harassment Act 1997 ss1–2 & 3",
    deadline: k.quantifyLossBy,
    deadlineBasis: "Do immediately while the messages are available (evaluation + 7 days).",
    nextAction:
      `Screenshot and back up every threatening or abusive message from ${c.contractor.name} ` +
      "(with dates, times and the sender's number). Do not reply in anger or pay anything not " +
      "properly invoiced and evidenced. If you feel threatened or harassed, report it to the " +
      "police (101) or via a non-emergency online report — a repeated course of conduct may be " +
      "an offence and grounds for a civil injunction under the Protection from Harassment Act 1997.",
  },
  quantifyLossTool(c, k),
  letterBeforeClaimTool(c, k, true),
  countyCourtTool(c, k),
];

/* ------------------------------------------------------------------ *
 * Branch C — NEGOTIATING
 * Contractor is engaging. Anchor on the remedial cost; settle in writing;
 * keep the LBC/court route in reserve.
 * ------------------------------------------------------------------ */
const negotiating: ToolBuilder = (c, k) => [
  quantifyLossTool(c, k),
  {
    id: "settle-on-remedial-cost",
    title: "Negotiate a settlement for the remedial cost",
    category: "negotiation",
    priority: 2,
    legalBasis: liabilityBasis(c),
    deadline: k.letterBeforeClaimSendBy,
    deadlineBasis: `Put a written, time-limited offer while talks are live (${formatUK(k.letterBeforeClaimSendBy)}).`,
    nextAction:
      `Write to ${c.contractor.name} on a "without prejudice" basis proposing that they either ` +
      `return to complete the works to the agreed standard or pay the ${money(recoverableLoss(c))} ` +
      "reasonable cost of completion. Ask them to set out, in writing and with evidence, any sum " +
      "they say is genuinely outstanding so it can be netted off. Confirm any agreement in writing " +
      "before paying.",
  },
  letterBeforeClaimTool(c, k, false),
  countyCourtTool(c, k),
];

const BUILDERS: Record<BuildingDisputeBranch, ToolBuilder> = {
  INCOMPLETE_OR_DEFECTIVE: incompleteOrDefective,
  CONTRACTOR_THREATENING: contractorThreatening,
  NEGOTIATING: negotiating,
};

/** Returns the matched, priority-ordered toolset for a branch. */
export function buildToolsForBranch(
  branch: BuildingDisputeBranch,
  c: BuildingDisputeCase,
  k: KeyDates,
): Tool[] {
  return BUILDERS[branch](c, k).sort((a, b) => a.priority - b.priority);
}

/**
 * Calibrated Letter Before Claim (Never Split the Difference style). It is an
 * information-gathering instrument, not boilerplate: a label to name the
 * situation, a disarming line, calibrated "How/What" questions the contractor
 * must answer to engage, a concrete deadline, and a compliant statement of
 * consequences. The job of this letter is to GET A RESPONSE — that response is
 * the information the next round depends on.
 */
function letterBeforeClaimTemplate(c: BuildingDisputeCase, k: KeyDates, firm: boolean): string {
  const deadline = formatUK(k.letterBeforeClaimResponseDeadline);
  const paid = money(totalPaid(c));
  const loss = money(recoverableLoss(c));

  const lines = [
    `Dear ${c.contractor.name},`,
    ``,
    `Re: Letter Before Claim — ${c.contract.scopeOfWorks} at ${c.property.address}`,
    ``,
    `You agreed to carry out ${c.contract.scopeOfWorks} at the above property and I paid you ` +
      `${paid}. The work has been left incomplete and/or defective` +
      (c.defects ? `: ${c.defects}.` : "."),
    ``,
  ];

  if (c.customerType === "consumer") {
    // Label + the leverage (the statutory standard + the evidenced loss).
    lines.push(
      `As a consumer I am entitled under the Consumer Rights Act 2015 to services carried out ` +
        `with reasonable care and skill (s49) and within a reasonable time (s52). I have obtained ` +
        `a quote/invoice for the reasonable cost of completing and putting the work right, which ` +
        `comes to ${loss}.`,
    );
  } else {
    lines.push(
      `You are in breach of contract for failing to complete the work to the agreed standard. ` +
        `I have obtained a quote/invoice for the reasonable cost of completion and remedy, which ` +
        `comes to ${loss}.`,
    );
  }

  lines.push(
    ``,
    // Disarming / accusation audit.
    firm
      ? `I want to keep this strictly to the facts. I will not respond to threats, and I will only ` +
        `pay sums that are properly invoiced and evidenced.`
      : `I'd genuinely like to resolve this directly, without either of us going to court.`,
    ``,
    // Calibrated questions — these require a reply (= information).
    `To help me understand where things stand:`,
    `  • How do you propose to complete the works to the agreed standard, or to cover the ${loss} ` +
      `cost of having them completed?`,
    `  • What, if anything, do you say is genuinely outstanding — set out in writing and with ` +
      `evidence — so it can be taken into account?`,
    ``,
    `To resolve this now, please either arrange to complete the works to the agreed standard or ` +
      `pay me ${loss} by ${deadline}.`,
    ``,
    `If I don't hear from you, I'll have little choice but to issue a claim in the County Court for ` +
      `the cost of completing and remedying the work, plus interest and costs. I would much rather ` +
      `settle it directly with you.`,
    ``,
    `Please reply by ${deadline} so we can sort this out.`,
    ``,
    `Yours sincerely,`,
    c.customer.name,
  );

  return lines.join("\n");
}
