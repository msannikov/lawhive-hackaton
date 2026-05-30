/**
 * The Tools Arsenal: the full catalogue of tools the passenger can use,
 * organised by decision-tree branch. Each builder takes the case + computed key
 * dates and returns concrete {@link Tool}s — every one carrying a next action
 * and a real deadline date.
 */

import type { Tool } from "../../core/types.ts";
import type { FlightDelayBranch, FlightDelayCase } from "./case.ts";
import { type KeyDates, COMPENSATION_BY_BAND, BAND_DESCRIPTION } from "./keyDates.ts";
import { formatUK } from "../../core/dates.ts";

type ToolBuilder = (c: FlightDelayCase, k: KeyDates) => Tool[];

const money = (n: number) => `£${n}`;
const sum = (c: FlightDelayCase) => COMPENSATION_BY_BAND[c.flight.distanceBand];

/** The verb that fits where the claim has got to. */
function claimVerb(c: FlightDelayCase): "Submit" | "Renew" {
  return c.claimStatus === "submitted" ||
    c.claimStatus === "acknowledged" ||
    c.claimStatus === "rejected"
    ? "Renew"
    : "Submit";
}

/* ------------------------------------------------------------------ *
 * Branch A — ELIGIBLE
 * Qualifying delay/cancellation/denied boarding with no genuine
 * extraordinary defence. Evidence the delay, claim the fixed sum, then
 * ADR, then a small claim before the 6-year longstop.
 * ------------------------------------------------------------------ */
const eligible: ToolBuilder = (c, k) => {
  const amount = sum(c);
  return [
    {
      id: "gather-flight-evidence",
      title: "Assemble the flight-delay evidence bundle",
      category: "evidence",
      priority: 1,
      legalBasis: "UK Regulation (EC) 261/2004 arts 5–7 (operating carrier's burden)",
      deadline: k.claimSendBy,
      deadlineBasis: "Do first — the evidence underpins the claim and any ADR/court step.",
      nextAction:
        `Collect: (1) the boarding pass and booking confirmation for ${c.flight.flightNumber}; ` +
        `(2) a flight-tracker record showing the ${arrivalDelayText(c)} on ${formatUK(k.flightDate)}; ` +
        "(3) any airline emails about the disruption; (4) the journey distance " +
        `(${c.flight.distanceKm != null ? `${c.flight.distanceKm} km` : "great-circle distance"}) ` +
        `confirming the ${BAND_DESCRIPTION[c.flight.distanceBand]} band.`,
    },
    {
      id: "submit-compensation-claim",
      title: `${claimVerb(c)} the written compensation claim for ${money(amount)}`,
      category: "letter",
      priority: 2,
      legalBasis: "UK Regulation (EC) 261/2004 art 7 (fixed compensation by distance)",
      deadline: k.claimSendBy,
      deadlineBasis: `Send within 7 days of evaluation (${formatUK(k.claimSendBy)}) to keep momentum.`,
      nextAction:
        `Write to ${c.flight.airline} (${c.passenger.email ? "from " + c.passenger.email : "in writing"}) ` +
        `claiming the fixed UK261 compensation of ${money(amount)} for ${c.flight.flightNumber} ` +
        `(${BAND_DESCRIPTION[c.flight.distanceBand]} journey). Cite the ${arrivalDelayText(c)} and ` +
        `give them until ${formatUK(k.airlineResponseDeadline)} to pay.`,
      documentTemplate: claimLetterTemplate(c, k),
    },
    {
      id: "escalate-adr",
      title: "Escalate to an approved ADR scheme (AviationADR / CEDR)",
      category: "adr",
      priority: 3,
      legalBasis: "CAA-approved alternative dispute resolution (ADR) scheme",
      deadline: k.adrEscalateBy,
      deadlineBasis:
        `If unpaid/rejected after ~8 weeks, escalate by ${formatUK(k.adrEscalateBy)} (free to the passenger).`,
      nextAction:
        `If ${c.flight.airline} has not paid the ${money(amount)} by ${formatUK(k.airlineResponseDeadline)} ` +
        "(or rejects it), open a free case with the airline's CAA-approved ADR body (e.g. AviationADR " +
        "or CEDR). Submit the evidence bundle; the decision binds the airline.",
    },
    {
      id: "small-claim",
      title: "Issue a small claim in the County Court",
      category: "court",
      priority: 4,
      legalBasis: "UK261 art 7; Limitation Act 1980 s5 (6-year limit, England & Wales)",
      deadline: k.claimLimitationLongstop,
      deadlineBasis:
        `Last resort — must be issued before the 6-year limitation longstop (${formatUK(k.claimLimitationLongstop)}).`,
      nextAction:
        `If ADR does not resolve it, issue a County Court money claim for the ${money(amount)} ` +
        "compensation (small-claims track). Attach the evidence bundle and the airline's refusal.",
    },
  ];
};

/* ------------------------------------------------------------------ *
 * Branch B — EXTRAORDINARY_CLAIMED
 * Airline blames extraordinary circumstances. Pin down its evidence and
 * challenge whether the defence really applies before escalating.
 * ------------------------------------------------------------------ */
const extraordinaryClaimed: ToolBuilder = (c, k) => {
  const amount = sum(c);
  const reason = c.disruption.reasonGiven ?? "extraordinary circumstances";
  return [
    {
      id: "request-extraordinary-proof",
      title: "Demand the airline's proof of extraordinary circumstances",
      category: "verify",
      priority: 1,
      legalBasis: "UK261 art 5(3) — burden of proof is on the operating carrier",
      deadline: k.claimSendBy,
      deadlineBasis: "Do first — the burden is on the airline; make it produce the evidence.",
      nextAction:
        `Write to ${c.flight.airline} requiring written proof that "${reason}" (1) actually caused the ` +
        `disruption to ${c.flight.flightNumber}, (2) was beyond its control, and (3) could not have been ` +
        "avoided even with all reasonable measures. Ask for the relevant NOTAMs / ATC or weather logs.",
    },
    {
      id: "verify-disruption-cause",
      title: "Independently verify the stated cause",
      category: "evidence",
      priority: 2,
      legalBasis: "UK261 art 5(3); CAA guidance on extraordinary circumstances",
      deadline: k.claimSendBy,
      deadlineBasis: "Gather before pressing the claim so you can rebut a weak defence.",
      nextAction:
        "Check whether OTHER flights on the same route/day operated normally, and what weather/ATC " +
        `records actually show for ${formatUK(k.flightDate)}. A technical fault, crew shortage or knock-on ` +
        "delay from an earlier rotation is usually NOT extraordinary and keeps the claim alive.",
    },
    {
      id: "press-or-renew-claim",
      title: `${claimVerb(c)} the ${money(amount)} claim, rebutting the defence`,
      category: "letter",
      priority: 3,
      legalBasis: "UK261 arts 5(3) & 7",
      deadline: k.claimSendBy,
      deadlineBasis: `Send within 7 days of evaluation (${formatUK(k.claimSendBy)}).`,
      nextAction:
        `Reply maintaining the ${money(amount)} claim: state that the airline has not discharged its burden ` +
        `under art 5(3), and that the cause given${c.disruption.reasonCategory === "technical" ? " (a technical fault)" : ""} ` +
        `does not defeat compensation. Give until ${formatUK(k.airlineResponseDeadline)} to pay.`,
      documentTemplate: claimLetterTemplate(c, k),
    },
    {
      id: "escalate-adr",
      title: "Escalate to ADR (AviationADR / CEDR) to test the defence",
      category: "adr",
      priority: 4,
      legalBasis: "CAA-approved ADR scheme; UK261 art 5(3)",
      deadline: k.adrEscalateBy,
      deadlineBasis: `Escalate by ${formatUK(k.adrEscalateBy)} if the airline maintains its refusal.`,
      nextAction:
        "Open a free ADR case (e.g. AviationADR or CEDR) and let the adjudicator decide whether the " +
        "extraordinary-circumstances defence is made out. Submit your verification evidence.",
    },
  ];
};

/* ------------------------------------------------------------------ *
 * Branch C — NOT_ELIGIBLE
 * Under the threshold / valid extraordinary / off-scope route. No fixed
 * compensation, but the right to care and out-of-pocket costs may stand.
 * ------------------------------------------------------------------ */
const notEligible: ToolBuilder = (c, k) => [
  {
    id: "claim-right-to-care",
    title: "Claim the right to care (meals / refreshments / accommodation)",
    category: "letter",
    priority: 1,
    legalBasis: "UK Regulation (EC) 261/2004 art 9 (right to care)",
    deadline: k.claimSendBy,
    deadlineBasis: "Care costs are recoverable even when no fixed compensation is due.",
    nextAction:
      `Although the ${money(COMPENSATION_BY_BAND[c.flight.distanceBand])} fixed compensation does not appear to ` +
      `be triggered, write to ${c.flight.airline} to reclaim reasonable meal, refreshment and (if you were kept ` +
      "overnight) accommodation costs caused by the disruption. Attach receipts.",
  },
  {
    id: "verify-threshold",
    title: "Double-check the delay length and journey distance",
    category: "verify",
    priority: 2,
    legalBasis: "UK261 arts 6–7",
    deadline: k.claimSendBy,
    deadlineBasis: "Confirm the figures — crossing 3 hours on arrival flips this to a fixed-sum claim.",
    nextAction:
      "Re-check the ACTUAL arrival time against the scheduled one: if the arrival delay was in fact 3 hours " +
      "or more (or a cancellation gave under 14 days' notice), the fixed compensation becomes payable and " +
      "this case moves to the ELIGIBLE branch.",
  },
];

const BUILDERS: Record<FlightDelayBranch, ToolBuilder> = {
  ELIGIBLE: eligible,
  EXTRAORDINARY_CLAIMED: extraordinaryClaimed,
  NOT_ELIGIBLE: notEligible,
};

/** Returns the matched, priority-ordered toolset for a branch. */
export function buildToolsForBranch(
  branch: FlightDelayBranch,
  c: FlightDelayCase,
  k: KeyDates,
): Tool[] {
  return BUILDERS[branch](c, k).sort((a, b) => a.priority - b.priority);
}

function arrivalDelayText(c: FlightDelayCase): string {
  const h = c.timings.arrivalDelayHours;
  if (c.disruption.type === "cancellation") return "cancellation";
  if (c.disruption.type === "denied_boarding") return "denied boarding";
  return h != null ? `${h}-hour arrival delay` : "arrival delay";
}

/**
 * Calibrated compensation-claim letter (Never Split the Difference style). It is
 * an information-gathering instrument, not boilerplate: a label naming the
 * situation, a disarming line, calibrated "How/What" questions the airline must
 * answer to engage, a concrete £ figure and deadline, and a compliant statement
 * of consequences. The job of this letter is to GET A RESPONSE — that response
 * is the information the next round depends on.
 */
function claimLetterTemplate(c: FlightDelayCase, k: KeyDates): string {
  const amount = money(sum(c));
  const deadline = formatUK(k.airlineResponseDeadline);
  const extraordinary = c.disruption.extraordinaryClaimed;
  const reason = c.disruption.reasonGiven;

  const lines = [
    `Dear ${c.flight.airline},`,
    ``,
    `Re: UK261 compensation claim — flight ${c.flight.flightNumber}, ${formatUK(k.flightDate)}`,
    ``,
    `I was a confirmed passenger on ${c.flight.flightNumber} from ${c.flight.origin} to ` +
      `${c.flight.destination} on ${formatUK(k.flightDate)}, which was disrupted (${disruptionPhrase(c)}).`,
    ``,
    `Under retained Regulation (EC) 261/2004 ("UK261"), this entitles me to fixed compensation of ` +
      `${amount}, based on the ${BAND_DESCRIPTION[c.flight.distanceBand]} journey distance.`,
    ``,
    // Disarming / accusation audit.
    `I'd like to resolve this directly and quickly, without involving the CAA, an ADR scheme or the court.`,
    ``,
  ];

  if (extraordinary) {
    // Put the burden back on the airline with calibrated questions.
    lines.push(
      `I understand you may rely on "extraordinary circumstances"${reason ? ` ("${reason}")` : ""}. ` +
        `The burden under article 5(3) is on you, so to understand your position:`,
      `  • What evidence shows this cause was genuinely beyond your control?`,
      `  • What reasonable measures did you take to avoid the disruption, and why did they not work?`,
    );
  } else {
    lines.push(
      `To help me understand where things stand:`,
      `  • What is preventing payment of the ${amount} owed under article 7?`,
      `  • If you dispute it, on exactly what basis?`,
    );
  }

  lines.push(
    ``,
    `To settle this now, please pay the ${amount} to me by ${deadline}.`,
    ``,
    `If I don't hear from you, I'll refer the matter to your CAA-approved ADR scheme (for example ` +
      `AviationADR or CEDR) and, if necessary, issue a County Court claim. I would much rather settle ` +
      `it with you directly.`,
    ``,
    `Please reply by ${deadline}.`,
    ``,
    `Yours faithfully,`,
    c.passenger.name,
  );

  return lines.join("\n");
}

function disruptionPhrase(c: FlightDelayCase): string {
  switch (c.disruption.type) {
    case "cancellation":
      return c.cancellationNoticeDays != null
        ? `cancelled with ${c.cancellationNoticeDays} days' notice`
        : "cancelled at short notice";
    case "denied_boarding":
      return "denied boarding";
    case "delay":
    default:
      return c.timings.arrivalDelayHours != null
        ? `arriving ${c.timings.arrivalDelayHours} hours late`
        : "significantly delayed on arrival";
  }
}
