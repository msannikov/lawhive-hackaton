/**
 * The Tools Arsenal: the full catalogue of tools the tenant can use, organised
 * by decision-tree branch. Each builder takes the case + computed key dates and
 * returns concrete {@link Tool}s — every one carrying a next action, a real
 * deadline date, and (where it exists) the legal basis.
 */

import type { Tool } from "../../core/types.ts";
import type { HousingDisrepairBranch, HousingDisrepairCase } from "./case.ts";
import type { KeyDates } from "./keyDates.ts";
import { formatUK } from "../../core/dates.ts";

type ToolBuilder = (c: HousingDisrepairCase, k: KeyDates) => Tool[];

const roomList = (c: HousingDisrepairCase) =>
  c.disrepair.roomsAffected.length ? c.disrepair.roomsAffected.join(", ") : "the affected rooms";

const ombudsmanFor = (c: HousingDisrepairCase) =>
  c.tenancy.landlordType === "council" || c.tenancy.landlordType === "housing_association"
    ? "the Housing Ombudsman"
    : "the relevant redress scheme";

/**
 * Three tools every branch shares: log the report + evidence, send the Protocol
 * Letter of Claim, and (the decision step) issue County Court proceedings.
 * Branches re-order and supplement these.
 */
function logEvidence(c: HousingDisrepairCase, k: KeyDates): Tool {
  return {
    id: "log-report-and-evidence",
    title: "Log the report date and assemble the evidence bundle",
    category: "evidence",
    priority: 1,
    legalBasis: "Landlord and Tenant Act 1985 s11 & s9A (notice + reasonable time to repair)",
    deadline: k.letterOfClaimSendBy,
    deadlineBasis: "Do first — the report date and evidence underpin every later step.",
    nextAction:
      `Pin down that you first reported the ${c.disrepair.description} on ${formatUK(k.firstReportedDate)} ` +
      `and collect: (1) every report and chase (emails, the phone-call log); (2) dated photos of the ` +
      `mould in ${roomList(c)}; (3) the council/EHO inspection report; (4) the contractor's works form; ` +
      `(5) any GP / medical letter. This is the bundle the Letter of Claim and any court claim rest on.`,
  };
}

function letterOfClaim(c: HousingDisrepairCase, k: KeyDates): Tool {
  return {
    id: "send-letter-of-claim",
    title: "Send a Pre-Action Protocol Letter of Claim",
    category: "letter",
    priority: 2,
    legalBasis:
      "Pre-Action Protocol for Housing Conditions Claims (England); Landlord and Tenant Act 1985 s11 & s9A",
    deadline: k.letterOfClaimSendBy,
    deadlineBasis: `Send within 7 days of evaluation (by ${formatUK(k.letterOfClaimSendBy)}) to keep momentum.`,
    nextAction:
      `Send ${c.landlord.name}${c.landlord.email ? ` (${c.landlord.email})` : ""} a Letter of Claim under the ` +
      `Pre-Action Protocol for Housing Conditions Claims. Describe the ${c.disrepair.description} in ` +
      `${roomList(c)}, the date first reported (${formatUK(k.firstReportedDate)}) and the inaction since, ` +
      `and demand the remedial works plus damages. The landlord must respond and disclose its repair / ` +
      `inspection records within 20 working days (by ${formatUK(k.protocolResponseDeadline)}).`,
    documentTemplate: letterOfClaimTemplate(c, k),
  };
}

function countyCourtClaim(c: HousingDisrepairCase, k: KeyDates): Tool {
  return {
    id: "county-court-claim",
    title: "Issue a County Court claim for the works + damages",
    category: "court",
    priority: 4,
    legalBasis:
      "Landlord and Tenant Act 1985 s11 & s9A (specific performance + damages); Homes (Fitness for Human Habitation) Act 2018",
    deadline: k.issueProceedingsBy,
    deadlineBasis:
      `If unremedied after the 20-working-day protocol window (${formatUK(k.protocolResponseDeadline)}), ` +
      `issue by ${formatUK(k.issueProceedingsBy)} — and well inside the limitation period.`,
    nextAction:
      `If the landlord does not carry out the works (or recurrence persists) after ` +
      `${formatUK(k.protocolResponseDeadline)}, issue a County Court claim for an order that the works be ` +
      `done (specific performance) plus general damages for loss of amenity and any personal injury. ` +
      `Limitation: ${formatUK(k.contractLimitationLongstop)} (contract) / ` +
      `${formatUK(k.personalInjuryLimitationLongstop)} (personal injury).`,
  };
}

/* ------------------------------------------------------------------ *
 * Branch A — URGENT_HEALTH_RISK
 * Serious mould + GP-evidenced harm / vulnerable occupant. Push the EHO and
 * urgent works in parallel with the protocol route; get legal advice.
 * ------------------------------------------------------------------ */
const urgentHealthRisk: ToolBuilder = (c, k) => [
  {
    id: "request-eho-inspection",
    title: "Demand an urgent Environmental Health (EHO) inspection",
    category: "verify",
    priority: 1,
    legalBasis: "Housing Act 2004 Part 1 (HHSRS); Environmental Protection Act 1990 s79–80",
    deadline: k.urgentEscalateBy,
    deadlineBasis: `Urgent — push within 3 days (by ${formatUK(k.urgentEscalateBy)}) given the health risk.`,
    nextAction:
      `Ask the council's Environmental Health team to inspect under the HHSRS as a matter of urgency, ` +
      `citing the damp / mould in ${roomList(c)}` +
      (c.inspection.hhsrsCategory1 ? " already pre-screened as a Category 1 hazard" : "") +
      (c.health.gpLetterProvided ? " and the GP letter evidencing the health impact" : "") +
      `. A Category 1 finding can compel the landlord to act.`,
  },
  logEvidence(c, k),
  letterOfClaim(c, k),
  countyCourtClaim(c, k),
];

/* ------------------------------------------------------------------ *
 * Branch B — REPORTED_NOT_REPAIRED
 * Notified, reasonable time passed, still not fixed. Build the bundle, send the
 * Letter of Claim, run the protocol window, then County Court.
 * ------------------------------------------------------------------ */
const reportedNotRepaired: ToolBuilder = (c, k) => [
  logEvidence(c, k),
  letterOfClaim(c, k),
  {
    id: "track-protocol-response",
    title: "Track the landlord's 20-working-day protocol response",
    category: "chase",
    priority: 3,
    legalBasis: "Pre-Action Protocol for Housing Conditions Claims (England)",
    deadline: k.protocolResponseDeadline,
    deadlineBasis: `Landlord must respond + disclose records by ${formatUK(k.protocolResponseDeadline)} (20 working days).`,
    nextAction:
      `Diarise ${formatUK(k.protocolResponseDeadline)}. By then the landlord must respond to the Letter of ` +
      `Claim, set out its position and disclose its repair and inspection records. Silence or refusal opens ` +
      `the County Court route; consider raising a complaint to ${ombudsmanFor(c)} in parallel.`,
  },
  countyCourtClaim(c, k),
];

/* ------------------------------------------------------------------ *
 * Branch C — LANDLORD_ACTING
 * Works scheduled / done. Keep the bundle current and verify completion;
 * preserve the protocol route in case the repair does not hold.
 * ------------------------------------------------------------------ */
const landlordActing: ToolBuilder = (c, k) => [
  {
    id: "confirm-works-in-writing",
    title: "Confirm the scheduled works and scope in writing",
    category: "negotiation",
    priority: 1,
    legalBasis: "Landlord and Tenant Act 1985 s11 & s9A",
    deadline: k.urgentEscalateBy,
    deadlineBasis: "Confirm promptly so the agreed scope and dates are on the record.",
    nextAction:
      `Write to ${c.landlord.name} confirming the agreed works to ${roomList(c)}, the start date and that ` +
      `they address the cause (not just a fungicidal wash), and ask for a post-works inspection. Do NOT sign ` +
      `any form that waives your claim — a satisfaction note does not extinguish the statutory duty.`,
  },
  logEvidence(c, k),
  {
    id: "monitor-completion",
    title: "Monitor completion and watch for recurrence",
    category: "chase",
    priority: 3,
    legalBasis: "Landlord and Tenant Act 1985 s9A (Homes (Fitness for Human Habitation) Act 2018)",
    deadline: k.reasonableRepairDeadline,
    deadlineBasis: `Verify the defect is actually resolved by ${formatUK(k.reasonableRepairDeadline)}.`,
    nextAction:
      `Keep dated photos after the works. If the damp / mould recurs or the works slip, escalate: send the ` +
      `Pre-Action Protocol Letter of Claim, which gives the landlord 20 working days to respond before court.`,
    documentTemplate: letterOfClaimTemplate(c, k),
  },
  letterOfClaim(c, k),
];

const BUILDERS: Record<HousingDisrepairBranch, ToolBuilder> = {
  URGENT_HEALTH_RISK: urgentHealthRisk,
  REPORTED_NOT_REPAIRED: reportedNotRepaired,
  LANDLORD_ACTING: landlordActing,
};

/** Returns the matched, priority-ordered toolset for a branch. */
export function buildToolsForBranch(
  branch: HousingDisrepairBranch,
  c: HousingDisrepairCase,
  k: KeyDates,
): Tool[] {
  return BUILDERS[branch](c, k).sort((a, b) => a.priority - b.priority);
}

/**
 * Calibrated Letter of Claim (Never Split the Difference style, fitted to the
 * Housing Conditions Pre-Action Protocol). It is an information-gathering
 * instrument, not boilerplate: a label that names the situation, a disarming
 * line, calibrated "How/What" questions the landlord must answer to engage, the
 * statutory 20-working-day deadline for a response + records, and a compliant
 * statement of consequences. The job of this letter is to GET A RESPONSE AND
 * DISCLOSURE — that is the information the next round depends on.
 */
function letterOfClaimTemplate(c: HousingDisrepairCase, k: KeyDates): string {
  const responseBy = formatUK(k.protocolResponseDeadline);
  const rooms = roomList(c);

  const lines = [
    `Dear ${c.landlord.name},`,
    ``,
    `Re: Letter of Claim — housing disrepair at ${c.property.address}`,
    `Pre-Action Protocol for Housing Conditions Claims (England)`,
    ``,
    `I am the tenant of the above property. I first reported ${c.disrepair.description} affecting ` +
      `${rooms} on ${formatUK(k.firstReportedDate)}, and it remains unresolved.`,
    ``,
  ];

  if (c.inspection.inspected && c.inspection.hhsrsCategory1) {
    lines.push(
      `Your own inspection recorded this as a Category 1 hazard under the HHSRS, yet the condition ` +
        `persists.`,
    );
  }
  if (c.health.gpLetterProvided) {
    lines.push(
      `I also enclose a GP letter setting out the impact of these conditions on a member of my household.`,
    );
  }

  lines.push(
    ``,
    // Disarming / accusation audit.
    `I would genuinely prefer to resolve this directly, without issuing court proceedings.`,
    ``,
    // Calibrated questions — these require a substantive reply (= information + disclosure).
    `To understand where things stand, please tell me:`,
    `  • How does the property meet your repairing obligations under section 11 and the duty to ensure ` +
      `it is fit for human habitation under section 9A of the Landlord and Tenant Act 1985, given the ` +
      `condition of ${rooms}?`,
    `  • What works will you carry out to fix the cause (not just treat the surface), and by when?`,
    ``,
    `Under the Pre-Action Protocol for Housing Conditions Claims you must respond to this letter and ` +
      `disclose your repair and inspection records within 20 working days, that is by ${responseBy}.`,
    ``,
    `If the works are not carried out and I do not receive your response and records by ${responseBy}, ` +
      `I may issue a claim in the County Court for an order that the works be done and for damages for ` +
      `loss of amenity and any harm to health. I would much rather settle this with you directly.`,
    ``,
    `Please respond by ${responseBy}.`,
    ``,
    `Yours faithfully,`,
    c.tenant.name,
  );

  return lines.join("\n");
}
