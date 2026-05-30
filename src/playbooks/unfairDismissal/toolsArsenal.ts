/**
 * The Tools Arsenal: the full catalogue of tools the employee can use, organised
 * by decision-tree branch. Each builder takes the case + computed key dates and
 * returns concrete {@link Tool}s — every one carrying a next action and a real
 * deadline date.
 *
 * The two dated steps that dominate this domain appear (with branch-specific
 * framing) in every branch:
 *   - lodge the ET1 by the computed tribunal limit (ACAS-adjusted); and
 *   - decide on / respond to the settlement offer before that limit.
 */

import type { Tool } from "../../core/types.ts";
import type { UnfairDismissalBranch, UnfairDismissalCase } from "./case.ts";
import type { KeyDates } from "./keyDates.ts";
import { formatUK, parseISO } from "../../core/dates.ts";

type ToolBuilder = (c: UnfairDismissalCase, k: KeyDates) => Tool[];

const money = (n: number) => `£${n.toFixed(2)}`;

/** Best-effort monthly gross for loss framing (contract or payslip). */
function monthlyGross(c: UnfairDismissalCase): number | undefined {
  if (c.pay.monthlyGross != null) return c.pay.monthlyGross;
  if (c.pay.annualGross != null) return c.pay.annualGross / 12;
  return undefined;
}

/** How the ET1 limit was derived — shown verbatim on the lodge-ET1 tool. */
function etLimitBasis(k: KeyDates): string {
  const primary = `EDT ${formatUK(k.limitAnchor)} + 3 months − 1 day = ${formatUK(k.primaryEtLimit)}`;
  if (k.acasDayA && k.acasDayB) {
    return k.acasExtended
      ? `${primary}; extended by the ACAS stop-the-clock ` +
          `(Day A ${formatUK(k.acasDayA)} → Day B ${formatUK(k.acasDayB)}, ${k.acasStopDays} days) ` +
          `→ ${formatUK(k.etLimit)}.`
      : `${primary}. ACAS Early Conciliation (Day A ${formatUK(k.acasDayA)} → Day B ` +
          `${formatUK(k.acasDayB)}) was started before the primary limit began to run, so the ` +
          `s207B extension does not move it (it can only extend) → limit stays ${formatUK(k.etLimit)}.`;
  }
  return `${primary}. No completed ACAS EC dates found, so no stop-the-clock extension is applied.`;
}

/* ------------------------------------------------------------------ *
 * Shared tools (appear in the claim branches with consistent ids).
 * ------------------------------------------------------------------ */

function gatherEvidenceTool(c: UnfairDismissalCase, k: KeyDates): Tool {
  return {
    id: "gather-evidence",
    title: "Assemble the employment evidence bundle",
    category: "evidence",
    priority: 1,
    legalBasis: "ET Rules of Procedure 2013; ACAS Code of Practice on Disciplinary and Grievance Procedures",
    deadline: k.evidenceBy,
    deadlineBasis: `Do first — underpins valuation, the ET1 and the settlement decision (by ${formatUK(k.evidenceBy)}).`,
    nextAction:
      "Collect: the contract/written particulars (start date, salary, notice), the " +
      `${c.dismissal.reason} letter` +
      (c.dismissal.noticeDate ? ` of ${formatUK(parseISO(c.dismissal.noticeDate))}` : "") +
      ", the grievance + its outcome, the redundancy appeal + its outcome, the ACAS EC " +
      "certificate, the settlement offer, your payslips, and any emails/notes evidencing the facts.",
  };
}

function takeAdviceTool(c: UnfairDismissalCase, k: KeyDates): Tool {
  return {
    id: "take-specialist-advice",
    title: "Get specialist employment-law advice",
    category: "negotiation",
    priority: 2,
    legalBasis:
      "Equality Act 2010; Employment Rights Act 1996 — tribunal claims and settlements are strictly time-limited and technical",
    deadline: k.adviceBy,
    deadlineBasis: `Well before the ET1 limit (by ${formatUK(k.adviceBy)}) so advice can inform both the claim and the offer.`,
    nextAction:
      "Take advice from a specialist employment solicitor or your union before lodging the ET1 or " +
      "accepting any offer. Ask them to value the claim (loss of earnings + any injury-to-feelings " +
      "award) so the offer can be judged against it.",
  };
}

function decideSettlementTool(c: UnfairDismissalCase, k: KeyDates): Tool {
  const amount = c.settlement.amount != null ? money(c.settlement.amount) : "the offered sum";
  const mg = monthlyGross(c);
  const vehicleNote =
    c.settlement.vehicle === "cot3"
      ? "It is offered as an ACAS COT3 (binding once recorded by ACAS; independent legal advice is not legally required, but get it anyway)."
      : c.settlement.vehicle === "settlement_agreement"
        ? "It is a statutory settlement agreement (s203 ERA 1996) — it is NOT binding unless you take independent legal advice on it."
        : "Confirm whether it is a COT3 or a s203 settlement agreement (the latter REQUIRES independent legal advice to bind).";
  return {
    id: "evaluate-settlement-offer",
    title: "Evaluate the settlement offer against the claim's value",
    category: "negotiation",
    priority: 3,
    legalBasis: "s203 Employment Rights Act 1996 (settlement agreements); ACAS-conciliated COT3 settlements",
    deadline: k.settlementDecideBy,
    deadlineBasis:
      `Decide before it lapses and before the ET1 limit (by ${formatUK(k.settlementDecideBy)}) — ` +
      "an offer is worth nothing once the claim is time-barred.",
    nextAction:
      `Weigh the offer of ${amount} against the likely tribunal award` +
      (mg
        ? ` (compensation broadly tracks lost earnings — about ${money(mg)}/month gross — plus, on a ` +
          "discrimination claim, an uncapped award and injury to feelings under the Vento bands)"
        : "") +
      `. ${vehicleNote} If you do not accept, you must present the ET1 by ${formatUK(k.etLimit)}.`,
    documentTemplate: settlementResponseTemplate(c, k),
  };
}

function lodgeEt1Tool(
  c: UnfairDismissalCase,
  k: KeyDates,
  priority: number,
  legalBasis: string,
): Tool {
  return {
    id: "lodge-et1",
    title: "Present the ET1 claim to the Employment Tribunal",
    category: "court",
    priority,
    legalBasis,
    deadline: k.etLimit,
    deadlineBasis: etLimitBasis(k),
    nextAction:
      `If the matter is not settled, present Form ET1 online at ` +
      `www.gov.uk/employment-tribunals/make-a-claim by ${formatUK(k.etLimit)}, quoting the ACAS EC ` +
      `certificate number${c.acas.certificateNumber ? ` (${c.acas.certificateNumber})` : ""}. ` +
      "A claim presented even one day late will normally be rejected. Have a specialist check it first.",
  };
}

/* ------------------------------------------------------------------ *
 * Branch A — DISCRIMINATION_CLAIM
 * Equality Act 2010: no qualifying period; strongest where the redundancy
 * looks like a pretext or a protected act was done (victimisation).
 * ------------------------------------------------------------------ */
const discriminationClaim: ToolBuilder = (c, k) => {
  const ground = c.discrimination.ground ?? "the protected characteristic";
  return [
    gatherEvidenceTool(c, k),
    takeAdviceTool(c, k),
    decideSettlementTool(c, k),
    {
      id: "request-data-and-comparators",
      title: "Request the selection/scoring evidence (and consider a DSAR)",
      category: "evidence",
      priority: 4,
      legalBasis: "Equality Act 2010 (burden of proof, s136); UK GDPR / Data Protection Act 2018 (subject access)",
      deadline: k.evidenceBy,
      deadlineBasis: `Gather alongside the evidence bundle (by ${formatUK(k.evidenceBy)}).`,
      nextAction:
        "Ask in writing for the redundancy scoring matrix and your comparators' treatment; if refused, " +
        "make a Data Subject Access Request. These shift the burden of proof: once you show facts from " +
        `which discrimination on the ground of ${ground} could be inferred, the employer must prove the ` +
        "dismissal was in no sense because of it.",
    },
    lodgeEt1Tool(
      c,
      k,
      5,
      "Equality Act 2010 (direct/indirect discrimination + victimisation); Employment Rights Act 1996 (unfair dismissal, if 2+ years)",
    ),
  ];
};

/* ------------------------------------------------------------------ *
 * Branch B — UNFAIR_DISMISSAL
 * 2+ years' service, no discrimination alleged: was the redundancy genuine
 * and fairly conducted (pool, selection, consultation, suitable alternatives)?
 * ------------------------------------------------------------------ */
const unfairDismissal: ToolBuilder = (c, k) => [
  gatherEvidenceTool(c, k),
  takeAdviceTool(c, k),
  decideSettlementTool(c, k),
  {
    id: "scrutinise-redundancy-fairness",
    title: "Scrutinise whether the redundancy was genuine and fair",
    category: "evidence",
    priority: 4,
    legalBasis: "Employment Rights Act 1996 s98(4), s139; Williams v Compair Maxam (fair redundancy principles)",
    deadline: k.evidenceBy,
    deadlineBasis: `Assess alongside the evidence bundle (by ${formatUK(k.evidenceBy)}).`,
    nextAction:
      "Test the redundancy: was there a genuine diminution of work, a fair selection pool and criteria, " +
      "meaningful consultation, and a search for suitable alternative employment? Note whether your duties " +
      "were simply redistributed to colleagues (a sign the role was not truly redundant) and whether the " +
      "appeal was a fair rehearing.",
  },
  lodgeEt1Tool(
    c,
    k,
    5,
    "Employment Rights Act 1996 s94/s98 (unfair dismissal); s139 (redundancy definition)",
  ),
];

/* ------------------------------------------------------------------ *
 * Branch C — SETTLEMENT_DECISION
 * An offer is on the table (and the ordinary unfair-dismissal route is weak —
 * e.g. under 2 years, no discrimination). Value the offer; decide before the limit.
 * ------------------------------------------------------------------ */
const settlementDecision: ToolBuilder = (c, k) => {
  // Promote the settlement decision to the lead move in this branch.
  const decide = { ...decideSettlementTool(c, k), priority: 1 };
  const evidence = { ...gatherEvidenceTool(c, k), priority: 2 };
  const advice = { ...takeAdviceTool(c, k), priority: 3 };
  return [
    decide,
    evidence,
    advice,
    lodgeEt1Tool(
      c,
      k,
      4,
      "Employment Rights Act 1996 (preserves any claim if the offer is declined — note the strict time limit)",
    ),
  ];
};

/* ------------------------------------------------------------------ *
 * Branch D — REVIEW_NEEDED
 * Facts incomplete (no EDT, or thin rights). Gather the missing facts; the
 * time limit may already be running, so act on a conservative footing.
 * ------------------------------------------------------------------ */
const reviewNeeded: ToolBuilder = (c, k) => {
  const tools: Tool[] = [
    {
      id: "establish-key-dates",
      title: "Establish the dismissal date and qualifying service",
      category: "verify",
      priority: 1,
      legalBasis: "Employment Rights Act 1996 s97 (effective date of termination); s108 (qualifying period)",
      deadline: k.evidenceBy,
      deadlineBasis: `Do first — without the EDT the tribunal deadline cannot be fixed (by ${formatUK(k.evidenceBy)}).`,
      nextAction:
        "Pin down the effective date of termination (last day of employment) and your start of continuous " +
        "service from the contract, dismissal letter and payslips. Note any facts suggesting discrimination " +
        "or an automatic-unfair reason, which would remove the 2-year qualifying requirement.",
    },
    takeAdviceTool(c, k),
  ];
  if (c.settlement.offered) tools.push({ ...decideSettlementTool(c, k), priority: 3 });
  tools.push(
    lodgeEt1Tool(
      c,
      k,
      4,
      "Employment Rights Act 1996 / Equality Act 2010 — preserve the position; the 3-month limit may already be running",
    ),
  );
  return tools;
};

const BUILDERS: Record<UnfairDismissalBranch, ToolBuilder> = {
  DISCRIMINATION_CLAIM: discriminationClaim,
  UNFAIR_DISMISSAL: unfairDismissal,
  SETTLEMENT_DECISION: settlementDecision,
  REVIEW_NEEDED: reviewNeeded,
};

/** Returns the matched, priority-ordered toolset for a branch. */
export function buildToolsForBranch(
  branch: UnfairDismissalBranch,
  c: UnfairDismissalCase,
  k: KeyDates,
): Tool[] {
  return BUILDERS[branch](c, k).sort((a, b) => a.priority - b.priority);
}

/**
 * Calibrated response to a settlement offer (Never Split the Difference style).
 * Not an acceptance and not boilerplate: it is an information-gathering move —
 * a label, a disarming line, calibrated "How/What" questions that make the
 * employer justify its number, and a clear note that the tribunal deadline is
 * protected. The job of this letter is to GET MORE INFORMATION (and often a
 * better offer) before the irreversible decision to accept or to litigate.
 */
function settlementResponseTemplate(c: UnfairDismissalCase, k: KeyDates): string {
  const amount = c.settlement.amount != null ? money(c.settlement.amount) : "the proposed sum";
  const ground = c.discrimination.ground ?? "a protected characteristic";

  const lines = [
    `Dear ${c.employer.name},`,
    ``,
    `Re: Settlement discussions (without prejudice) — ${c.employee.name}`,
    ``,
    `Thank you for the offer of ${amount} in respect of the termination of my employment.`,
    ``,
    // Disarming / accusation audit.
    `I'd genuinely like to resolve this without a tribunal hearing if we can reach something fair.`,
    ``,
  ];

  if (c.discrimination.alleged) {
    lines.push(
      `As you know, my concern is not only that the redundancy may not have been genuine, but that ` +
        `the decision was connected to ${ground} and to the grievance I raised — which the law treats ` +
        `as a protected act. A discrimination claim carries no qualifying-service requirement, is not ` +
        `subject to the unfair-dismissal cap, and can include an award for injury to feelings.`,
      ``,
    );
  } else {
    lines.push(
      `My concern is whether the redundancy was genuine and fairly conducted — the selection pool, the ` +
        `criteria and the consultation.`,
      ``,
    );
  }

  lines.push(
    // Calibrated questions — these require a reply (= information).
    `To help me evaluate the offer properly:`,
    `  • How was the figure of ${amount} arrived at, set against my loss of earnings and the value of the claims?`,
    `  • What is the basis for treating the redundancy as genuine when the duties appear to have continued?`,
    `  • What would it take to reach a figure that reflects the real risk on both sides?`,
    ``,
    `I am taking specialist advice on the value of the claim. To be clear, I am not accepting the offer as ` +
      `it stands, and nothing in this letter waives or extends my right to bring a tribunal claim: I will, ` +
      `if necessary, present my ET1 by the deadline of ${formatUK(k.etLimit)}.`,
    ``,
    `Please let me have your response, and the calculation behind the offer, so we can try to settle this ` +
      `sensibly before that date.`,
    ``,
    `Yours sincerely,`,
    c.employee.name,
  );

  return lines.join("\n");
}
