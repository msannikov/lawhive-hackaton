/**
 * Consumer-services playbook: UK consumer contract for a SERVICE not delivered.
 *
 * Legal essence (Consumer Rights Act 2015 ss48–57): a service must be performed
 * with reasonable care and skill (s49), within a reasonable time (s52) and as
 * described. Where it falls short the consumer's statutory remedies are repeat
 * performance (s55) and price reduction (s56); a TOTAL failure to perform is a
 * breach of contract entitling the consumer to a refund. Enforcement runs
 * through the Pre-Action Protocol and the County Court small claims track for
 * sums under £10,000. Limitation: 6 years from the breach.
 *
 * `assess` is the deterministic rules engine (the deposit playbook's
 * `matchToolset`), bundled with extraction + validation behind {@link Playbook}.
 */

import type {
  Playbook,
  CaseAssessment,
  Tool,
  EscalationSignal,
} from "../../core/types.ts";
import type { ConsumerServicesCase, Branch } from "./case.ts";
import {
  consumerServicesJsonSchema,
  consumerServicesGeminiSchema,
  EXTRACTION_INSTRUCTIONS,
} from "./schema.ts";
import { normalize } from "./normalize.ts";
import {
  parseISO,
  addCalendarDays,
  addYears,
  formatUK,
} from "../../core/dates.ts";
import { buildNextMove } from "../../core/negotiation.ts";

/** Small claims track ceiling — claims under this stay in the cheap, fast track. */
const SMALL_CLAIMS_LIMIT = 10_000;
const money = (n: number) => `£${n.toFixed(2)}`;

/* ------------------------------------------------------------------ *
 * Key dates — every deadline the tree and tools need, in one place.
 * ------------------------------------------------------------------ */
interface KeyDates {
  /** "Today" used for all relative deadlines. */
  evaluationDate: Date;
  /** Date of the breach, used for the 6-year limitation longstop. */
  breachDate: Date;
  /** 6-year limitation longstop for a breach-of-contract / CRA claim. */
  claimLimitationLongstop: Date;
  /** Send a Letter Before Claim by this date. */
  letterBeforeClaimSendBy: Date;
  /** Reasonable response window the LBC gives the supplier (14 days). */
  letterBeforeClaimResponseDeadline: Date;
  /** Soft deadline for an initial chase of an unresponsive supplier. */
  chaseBy: Date;
  /** Booking date, if known. */
  bookingDate?: Date;
  /** Service/event date, if known. */
  serviceDate?: Date;
}

function computeKeyDates(c: ConsumerServicesCase): KeyDates {
  const evaluationDate = c.evaluationDate
    ? parseISO(c.evaluationDate)
    : parseISO(new Date().toISOString().slice(0, 10));

  const bookingDate = c.service.bookingDate ? parseISO(c.service.bookingDate) : undefined;
  const serviceDate = c.service.serviceDate ? parseISO(c.service.serviceDate) : undefined;

  // The breach accrues when performance was due and failed. Best proxy: the
  // service/event date; else the booking date; else evaluation date.
  const breachDate = serviceDate ?? bookingDate ?? evaluationDate;
  const claimLimitationLongstop = addYears(breachDate, 6);

  // Pre-Action Protocol: write before issuing; give a reasonable time to reply.
  const letterBeforeClaimSendBy = addCalendarDays(evaluationDate, 7);
  const letterBeforeClaimResponseDeadline = addCalendarDays(letterBeforeClaimSendBy, 14);

  const chaseBy = addCalendarDays(evaluationDate, 3);

  return {
    evaluationDate,
    breachDate,
    claimLimitationLongstop,
    letterBeforeClaimSendBy,
    letterBeforeClaimResponseDeadline,
    chaseBy,
    bookingDate,
    serviceDate,
  };
}

/* ------------------------------------------------------------------ *
 * Decision tree
 *
 *   Consumer paid for a service.
 *     └─ Was it delivered?
 *          ├─ Nothing delivered / supplier vanished → TOTAL_NON_PERFORMANCE
 *          │     (total failure → refund; LBC, then small claim)
 *          └─ Delivered but poor or late → is the supplier engaging?
 *                ├─ Engaging  → SUPPLIER_ENGAGING (negotiate s55/s56 remedy)
 *                └─ Not / refusing → DEFECTIVE_OR_LATE
 *                      (demand repeat performance s55 or price reduction s56)
 * ------------------------------------------------------------------ */
const BRANCH_LABELS: Record<Branch, string> = {
  TOTAL_NON_PERFORMANCE: "Total non-performance → refund, then small claim",
  DEFECTIVE_OR_LATE: "Defective or late service → repeat performance or price reduction",
  SUPPLIER_ENGAGING: "Supplier engaging → negotiate a resolution",
};

function classify(c: ConsumerServicesCase): { branch: Branch; reasoning: string[] } {
  const reasoning: string[] = [];

  reasoning.push(
    `Consumer paid ${money(c.payment.amountPaid)} of a ${money(c.payment.totalPrice)} ` +
      `contract for ${c.service.serviceType}.`,
  );

  // Node 1: was anything delivered?
  if (c.delivery === "nothing_delivered") {
    reasoning.push(
      "Nothing was delivered / the supplier went silent → total failure to perform. " +
        "A total non-performance is a breach of contract entitling the consumer to a refund.",
    );
    return { branch: "TOTAL_NON_PERFORMANCE", reasoning };
  }

  // "unknown" + unresponsive supplier is treated as total non-performance: the
  // documents show payment and ignored messages with no evidence of delivery.
  if (c.delivery === "unknown" && c.supplierResponse === "unresponsive") {
    reasoning.push(
      "Delivery is not evidenced and the supplier is ignoring messages → treat as total " +
        "non-performance: payment made, service unperformed, supplier silent.",
    );
    return { branch: "TOTAL_NON_PERFORMANCE", reasoning };
  }

  // Node 2: delivered but inadequate — is the supplier still talking?
  if (c.supplierResponse === "engaging") {
    reasoning.push(
      "Service fell short of reasonable care and skill / a reasonable time, but the supplier " +
        "is engaging → negotiate a CRA remedy (repeat performance s55 or price reduction s56) first.",
    );
    return { branch: "SUPPLIER_ENGAGING", reasoning };
  }

  reasoning.push(
    "Service was defective or late (CRA 2015 s49/s52) and the supplier is not co-operating → " +
      "demand repeat performance (s55) or, if not possible/done in reasonable time, a price reduction (s56).",
  );
  return { branch: "DEFECTIVE_OR_LATE", reasoning };
}

/* ------------------------------------------------------------------ *
 * Tools arsenal — concrete tools per branch, each with a real deadline.
 * ------------------------------------------------------------------ */
type ToolBuilder = (c: ConsumerServicesCase, k: KeyDates) => Tool[];

const withinSmallClaims = (amount: number) => amount < SMALL_CLAIMS_LIMIT;

/** Court tool, shared by the non-performance and defective/late branches. */
function smallClaimTool(c: ConsumerServicesCase, k: KeyDates, claimAmount: number): Tool {
  const track = withinSmallClaims(claimAmount)
    ? "the small claims track (sums under £10,000)"
    : "the fast/multi track (the sum exceeds the £10,000 small claims limit)";
  return {
    id: "county-court-small-claim",
    title: "Issue a County Court money claim",
    category: "court",
    priority: 4,
    legalBasis:
      "Consumer Rights Act 2015 ss48–57; breach of contract; County Court small claims track (<£10,000)",
    deadline: k.claimLimitationLongstop,
    deadlineBasis:
      `Issue after the Letter Before Claim window expires and well before the 6-year ` +
      `limitation longstop (${formatUK(k.claimLimitationLongstop)}).`,
    nextAction:
      `If the supplier does not resolve this by ${formatUK(k.letterBeforeClaimResponseDeadline)}, ` +
      `issue a County Court money claim (e.g. via Money Claim Online) for ${money(claimAmount)} on ` +
      `${track}. Attach the booking confirmation, invoice/T&Cs, payment proofs and the unanswered messages.`,
  };
}

/* Branch A — TOTAL_NON_PERFORMANCE: refund, LBC, then small claim. */
const totalNonPerformance: ToolBuilder = (c, k) => [
  {
    id: "gather-evidence",
    title: "Assemble the evidence bundle",
    category: "evidence",
    priority: 1,
    legalBasis: "Consumer Rights Act 2015 ss48–57; breach of contract",
    deadline: k.letterBeforeClaimSendBy,
    deadlineBasis: "Do first — the evidence underpins the Letter Before Claim and any court claim.",
    nextAction:
      "Collect: (1) the booking confirmation; (2) the invoice and terms & conditions; " +
      `(3) every payment proof totalling ${money(c.payment.amountPaid)}; ` +
      "(4) screenshots of your unanswered messages showing the supplier has gone silent.",
  },
  {
    id: "letter-before-claim",
    title: "Send a Letter Before Claim demanding a refund",
    category: "letter",
    priority: 2,
    legalBasis:
      "Pre-Action Protocol for Debt Claims / general pre-action conduct; total failure to perform → refund",
    deadline: k.letterBeforeClaimSendBy,
    deadlineBasis: `Send within 7 days of evaluation (by ${formatUK(k.letterBeforeClaimSendBy)}).`,
    nextAction:
      `Send ${c.supplier.name} (${c.supplier.email ?? "by post and email"}) a Letter Before Claim ` +
      `demanding a full refund of the ${money(c.payment.amountPaid)} paid for ${c.service.serviceType}, ` +
      `which was never provided. Give 14 days to respond (by ${formatUK(k.letterBeforeClaimResponseDeadline)}) ` +
      "and state you will issue a County Court claim if it is not resolved.",
    documentTemplate: letterBeforeClaimTemplate(c, k, "refund"),
  },
  {
    id: "flag-limitation-longstop",
    title: "Note the 6-year limitation deadline",
    category: "verify",
    priority: 3,
    legalBasis: "Limitation Act 1980 s5 (6 years for breach of contract)",
    deadline: k.claimLimitationLongstop,
    deadlineBasis: `Any court claim must be issued before ${formatUK(k.claimLimitationLongstop)}.`,
    nextAction:
      `You have until ${formatUK(k.claimLimitationLongstop)} (6 years from the breach) to issue a ` +
      "claim. Act well before then — evidence and recovery prospects fade over time.",
  },
  smallClaimTool(c, k, c.payment.amountPaid),
];

/* Branch B — DEFECTIVE_OR_LATE: repeat performance (s55) or price reduction (s56). */
const defectiveOrLate: ToolBuilder = (c, k) => [
  {
    id: "gather-evidence",
    title: "Assemble the evidence bundle",
    category: "evidence",
    priority: 1,
    legalBasis: "Consumer Rights Act 2015 s49 (reasonable care and skill), s52 (reasonable time)",
    deadline: k.letterBeforeClaimSendBy,
    deadlineBasis: "Do first — document exactly how the service fell short.",
    nextAction:
      "Collect the booking confirmation, invoice/T&Cs and payment proofs, plus evidence of the " +
      `shortfall: ${c.service.whatWasDelivered ?? "what was delivered vs what was promised"}, ` +
      "dated photos/messages, and any deadlines that were missed.",
  },
  {
    id: "demand-repeat-performance",
    title: "Demand repeat performance, then a price reduction",
    category: "letter",
    priority: 2,
    legalBasis: "Consumer Rights Act 2015 s55 (repeat performance) and s56 (price reduction)",
    deadline: k.letterBeforeClaimSendBy,
    deadlineBasis: `Put your CRA remedy in writing within 7 days (by ${formatUK(k.letterBeforeClaimSendBy)}).`,
    nextAction:
      `Write to ${c.supplier.name} requiring the service to be re-performed correctly at no extra ` +
      "cost within a reasonable time (s55). If repeat performance is impossible or not done in a " +
      `reasonable time, demand an appropriate price reduction — up to the full ${money(c.payment.amountPaid)} ` +
      "paid (s56). Give 14 days to respond.",
    documentTemplate: letterBeforeClaimTemplate(c, k, "remedy"),
  },
  {
    id: "flag-limitation-longstop",
    title: "Note the 6-year limitation deadline",
    category: "verify",
    priority: 3,
    legalBasis: "Limitation Act 1980 s5 (6 years for breach of contract)",
    deadline: k.claimLimitationLongstop,
    deadlineBasis: `Any court claim must be issued before ${formatUK(k.claimLimitationLongstop)}.`,
    nextAction:
      `You have until ${formatUK(k.claimLimitationLongstop)} (6 years from the breach) to issue a ` +
      "claim for a price reduction / damages. Act well before then.",
  },
  smallClaimTool(c, k, c.payment.amountPaid),
];

/* Branch C — SUPPLIER_ENGAGING: negotiate the CRA remedy before escalating. */
const supplierEngaging: ToolBuilder = (c, k) => [
  {
    id: "gather-evidence",
    title: "Assemble the evidence bundle",
    category: "evidence",
    priority: 1,
    legalBasis: "Consumer Rights Act 2015 ss49–56",
    deadline: k.chaseBy,
    deadlineBasis: "Gather early so you can negotiate from a clear, evidenced position.",
    nextAction:
      "Collect the booking confirmation, invoice/T&Cs, payment proofs and a clear note of what " +
      "was promised vs delivered, so any agreed resolution is on your terms.",
  },
  {
    id: "negotiate-resolution",
    title: "Negotiate a resolution in writing",
    category: "negotiation",
    priority: 2,
    legalBasis: "Consumer Rights Act 2015 s55 (repeat performance) / s56 (price reduction)",
    deadline: k.letterBeforeClaimSendBy,
    deadlineBasis: `Engage promptly while the supplier is responsive (by ${formatUK(k.letterBeforeClaimSendBy)}).`,
    nextAction:
      `Reply to ${c.supplier.name} setting out the specific outcome you want — re-performance of ` +
      `${c.service.serviceType}, or a fair price reduction / partial refund of the ` +
      `${money(c.payment.amountPaid)} paid — and a date to agree it by. Confirm everything in writing.`,
  },
  {
    id: "letter-before-claim-fallback",
    title: "Letter Before Claim if talks stall",
    category: "letter",
    priority: 3,
    legalBasis: "Pre-Action Protocol; Consumer Rights Act 2015 ss55–56",
    deadline: k.letterBeforeClaimResponseDeadline,
    deadlineBasis: `Fallback if negotiation stalls (${formatUK(k.letterBeforeClaimResponseDeadline)}).`,
    nextAction:
      "If the supplier stops engaging or will not agree a fair outcome, escalate to a formal Letter " +
      "Before Claim giving 14 days, then a County Court claim.",
    documentTemplate: letterBeforeClaimTemplate(c, k, "remedy"),
  },
];

const BUILDERS: Record<Branch, ToolBuilder> = {
  TOTAL_NON_PERFORMANCE: totalNonPerformance,
  DEFECTIVE_OR_LATE: defectiveOrLate,
  SUPPLIER_ENGAGING: supplierEngaging,
};

function buildToolsForBranch(branch: Branch, c: ConsumerServicesCase, k: KeyDates): Tool[] {
  return BUILDERS[branch](c, k).sort((a, b) => a.priority - b.priority);
}

/**
 * Calibrated Letter Before Claim (Never Split the Difference style). It is an
 * information-gathering instrument, not boilerplate: a label to name the
 * situation, a disarming line, calibrated "How/What" questions the supplier must
 * answer to engage, a concrete deadline, and a compliant statement of
 * consequences. Its job is to GET A RESPONSE — the information the next round
 * depends on.
 */
function letterBeforeClaimTemplate(
  c: ConsumerServicesCase,
  k: KeyDates,
  mode: "refund" | "remedy",
): string {
  const deadline = formatUK(k.letterBeforeClaimResponseDeadline);
  const paid = money(c.payment.amountPaid);

  const lines = [
    `Dear ${c.supplier.name},`,
    ``,
    `Re: ${c.service.serviceType} — request to put things right`,
    ``,
    `I'm writing about the ${c.service.serviceType} I booked and paid ${paid} towards` +
      `${k.serviceDate ? `, due to be provided on ${formatUK(k.serviceDate)}` : ""}.`,
    ``,
  ];

  if (mode === "refund") {
    lines.push(
      `The service was never provided and I have not been able to get a response from you. ` +
        `A complete failure to perform is a breach of our contract, and I'm entitled to a full ` +
        `refund of the ${paid} I paid.`,
    );
  } else {
    lines.push(
      `Under the Consumer Rights Act 2015 a service must be carried out with reasonable care and ` +
        `skill and within a reasonable time. That hasn't happened here, so I'm entitled to have the ` +
        `service put right at no extra cost or, failing that, to an appropriate price reduction.`,
    );
  }

  lines.push(
    ``,
    // Disarming / accusation audit.
    `I'd genuinely like to resolve this directly with you, without either of us going to court.`,
    ``,
    // Calibrated questions — these require a reply (= information).
    `To help me understand where things stand:`,
    mode === "refund"
      ? `  • How would you like to arrange the refund of the ${paid} I've paid?`
      : `  • How can we put the ${c.service.serviceType} right, and by when?`,
    `  • What has stopped this from being sorted out so far?`,
    ``,
    mode === "refund"
      ? `To settle this now, please refund the full ${paid} to me by ${deadline}.`
      : `To settle this now, please confirm by ${deadline} how you will re-perform the service or ` +
          `what price reduction you will give.`,
    ``,
    `If I don't hear from you by ${deadline}, I'll have little choice but to issue a claim in the ` +
      `County Court for the sums owed under the Consumer Rights Act 2015 and for breach of contract. ` +
      `I would much rather settle it directly with you.`,
    ``,
    `Please reply by ${deadline} so we can sort this out.`,
    ``,
    `Yours sincerely,`,
    c.consumer.name,
  );

  return lines.join("\n");
}

/* ------------------------------------------------------------------ *
 * Escalation gate
 *
 * Negotiation = gather information before deciding. The user stays self-serve
 * while a calibrated letter can still move things, and only escalates to a human
 * lawyer once that information-gathering is exhausted (the orchestrator reports a
 * later `negotiationStage`). Same graduation as depositReturn.
 * ------------------------------------------------------------------ */
function escalationFor(c: ConsumerServicesCase, branch: Branch): EscalationSignal {
  const stage = c.negotiationStage ?? "initial";

  switch (branch) {
    case "SUPPLIER_ENGAGING":
      if (stage === "post_adr")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "Negotiation did not produce a fair resolution — a lawyer can advise on a County Court claim.",
          triggers: ["negotiation_exhausted"],
        };
      return {
        level: "self_serve",
        recommend: false,
        reason:
          "The supplier is engaging — handle the negotiation yourself and agree a CRA remedy " +
          "(repeat performance or price reduction). Escalate only if talks break down.",
        triggers: ["watch:negotiation_outcome"],
      };

    case "DEFECTIVE_OR_LATE":
      if (stage !== "initial")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "The supplier did not put the service right after your written demand — escalate to a " +
            "County Court claim or a lawyer.",
          triggers: ["no_remedy_after_letter"],
        };
      return {
        level: "monitor",
        recommend: false,
        reason:
          "Send the calibrated demand for repeat performance / price reduction yourself. Escalate " +
          "if it's ignored or the loss is high-value or legally complex.",
        triggers: ["watch:remedy_outcome"],
      };

    case "TOTAL_NON_PERFORMANCE":
    default:
      if (stage !== "initial")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "Supplier stayed silent after your Letter Before Claim — information-gathering is " +
            "exhausted; issue the County Court claim or instruct a lawyer.",
          triggers: ["no_response_after_letter"],
        };
      return {
        level: "monitor",
        recommend: false,
        reason:
          "Send the calibrated Letter Before Claim yourself to surface the supplier's position. " +
          "If still silent after the deadline, escalate to a County Court claim.",
        triggers: ["watch:before_court_filing"],
      };
  }
}

/* ------------------------------------------------------------------ *
 * assess — pure, deterministic rules engine.
 * ------------------------------------------------------------------ */
function assess(c: ConsumerServicesCase): CaseAssessment {
  const k = computeKeyDates(c);
  const { branch, reasoning } = classify(c);
  const tools = buildToolsForBranch(branch, c, k);

  const keyDates: Record<string, string> = {
    "Letter Before Claim — send by": formatUK(k.letterBeforeClaimSendBy),
    "Supplier response deadline (14 days)": formatUK(k.letterBeforeClaimResponseDeadline),
    "Limitation longstop (6 yrs)": formatUK(k.claimLimitationLongstop),
  };
  if (k.bookingDate) keyDates["Booking date"] = formatUK(k.bookingDate);
  if (k.serviceDate) keyDates["Service date"] = formatUK(k.serviceDate);

  const escalation = escalationFor(c, branch);
  const nextMove = buildNextMove(tools, escalation.recommend);

  const summary =
    `Matched branch "${BRANCH_LABELS[branch]}" (${escalation.level}) with ${tools.length} tool(s). ` +
    `Next move: ${nextMove?.title ?? "none"}`;

  return {
    branch,
    branchLabel: BRANCH_LABELS[branch],
    summary,
    reasoning,
    keyDates,
    tools,
    nextMove,
    escalation,
  };
}

export const consumerServicesPlaybook: Playbook<ConsumerServicesCase> = {
  id: "consumer_services",
  label: "UK consumer services not delivered",
  extraction: {
    instructions: EXTRACTION_INSTRUCTIONS,
    jsonSchema: consumerServicesJsonSchema as unknown as Record<string, unknown>,
    geminiSchema: consumerServicesGeminiSchema,
  },
  normalize: (raw, input, warnings) => normalize(raw, input, warnings),
  assess,
};
