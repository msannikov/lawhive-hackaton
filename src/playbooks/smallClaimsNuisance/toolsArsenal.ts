/**
 * The Tools Arsenal: the full catalogue of procedural tools the party can use,
 * organised by decision-tree branch. Each builder takes the case + computed key
 * dates and returns concrete {@link Tool}s — every one carrying a next action and
 * a real deadline date.
 *
 * Categories reused from the shared negotiation framing: "evidence" (gather your
 * leverage), "letter" (the calibrated move), "court" (the irreversible decision
 * step — relief/set-aside/appeal applications all live here, since they are the
 * time-critical steps that determine whether the case survives).
 */

import type { Tool } from "../../core/types.ts";
import type { SmallClaimsNuisanceBranch, SmallClaimsNuisanceCase } from "./case.ts";
import type { KeyDates } from "./keyDates.ts";
import { formatUK } from "../../core/dates.ts";

type ToolBuilder = (c: SmallClaimsNuisanceCase, k: KeyDates) => Tool[];

const money = (n: number) => `£${n.toFixed(2)}`;

const defendantContact = (c: SmallClaimsNuisanceCase) =>
  c.defendant.representative ?? c.defendant.email ?? `the Defendant (${c.defendant.name})`;

/* ------------------------------------------------------------------ *
 * Branch A — MISSED_DIRECTIONS_DEADLINE
 * A directions deadline lapsed but no final judgment yet. File the outstanding
 * document immediately and apply PROMPTLY for relief from sanctions (CPR 3.9 /
 * Denton). The application is the decision step.
 * ------------------------------------------------------------------ */
const missedDirectionsDeadline: ToolBuilder = (c, k) => {
  const step = c.missedDeadline?.step ?? "the outstanding document";
  const missedOn = k.missedDeadlineDate ? formatUK(k.missedDeadlineDate) : "the directions deadline";
  const hearing = k.finalHearingDate ? ` before the final hearing (${formatUK(k.finalHearingDate)})` : "";

  const tools: Tool[] = [
    {
      id: "file-outstanding-document",
      title: `File and serve the outstanding ${step} immediately`,
      category: "evidence",
      priority: 1,
      legalBasis: "CPR 32.10 (late witness evidence barred without permission); the directions order",
      deadline: k.fileOutstandingDocBy,
      deadlineBasis: "Do first, immediately — late compliance strengthens the relief application.",
      nextAction:
        `File the outstanding ${step} (due ${missedOn}) at ${c.court} and serve a copy on ` +
        `${defendantContact(c)} now, even though it is late. Filing it shows the breach has been remedied.`,
    },
    {
      id: "relief-from-sanctions-n244",
      title: "Apply for relief from sanctions on Form N244 (CPR 3.9 / Denton)",
      category: "court",
      priority: 2,
      legalBasis: "CPR 3.9; Denton v TH White [2014] EWCA Civ 906 (three-stage test)",
      deadline: k.applyBy,
      deadlineBasis: `Must be made PROMPTLY — as soon as possible (by ${formatUK(k.applyBy)}).`,
      nextAction:
        `Apply on Form N244 for relief from sanctions and pay the fee. Support it with a witness statement ` +
        `addressing the Denton three-stage test: (1) the seriousness/significance of missing the ${step} ` +
        `deadline on ${missedOn}; (2) the reason for the default; (3) all the circumstances, so the ${step} ` +
        `can be relied on${hearing}.`,
      documentTemplate: reliefApplicationTemplate(c, k),
    },
    {
      id: "address-single-joint-expert",
      title: "Resolve the single-joint-expert (causation evidence) position",
      category: "evidence",
      priority: 3,
      legalBasis: "CPR 35.4 (permission for expert evidence); CPR 35.7 (single joint expert)",
      deadline: k.nextDirectionsStep?.date ?? k.applyBy,
      deadlineBasis:
        "Causation in a tree-root nuisance usually needs expert evidence — resolve before the timetable closes.",
      nextAction:
        c.sje === "declined" || c.sje === "unknown"
          ? "Causation (whether the roots, not soil/age, caused the damage) likely requires expert evidence. " +
            "Agree a single joint expert (a chartered arboriculturist) under CPR 35.7 and seek the court's " +
            "permission under CPR 35.4 — a builder's quote alone may not prove causation."
          : "Progress the single joint expert: agree the joint letter of instruction and seek the court's " +
            "permission for the report under CPR 35.4.",
    },
  ];

  return tools;
};

/* ------------------------------------------------------------------ *
 * Branch B — JUDGMENT_ENTERED
 * An order/judgment is in force against the party. Two routes, both time-critical:
 * set-aside (CPR 13.3 default / 39.3 non-attendance) and/or appeal within 21 days.
 * ------------------------------------------------------------------ */
const judgmentEntered: ToolBuilder = (c, k) => {
  const madeOn = k.judgmentDate ? formatUK(k.judgmentDate) : "the judgment date";
  const appealBy = k.appealLongstop ? formatUK(k.appealLongstop) : "21 days from the decision";

  const tools: Tool[] = [
    {
      id: "preserve-appeal-deadline",
      title: "Protect the 21-day appeal deadline (Appellant's Notice N164)",
      category: "court",
      priority: 1,
      legalBasis: "CPR 52.12 (appellant's notice within 21 days); CPR Part 52",
      deadline: k.appealLongstop ?? k.applyBy,
      deadlineBasis: `HARD DEADLINE — 21 days from the decision of ${madeOn} (by ${appealBy}). Missing it is usually fatal.`,
      nextAction:
        `If you may appeal, file an Appellant's Notice (Form N164) at the appeal court by ${appealBy} — ` +
        `21 days from the order of ${madeOn} (CPR 52.12)` +
        (c.judgment?.permissionToAppealRefused
          ? ". Permission to appeal was refused below, so ask the appeal court for permission in the notice."
          : ". Include any application for permission to appeal.") +
        " An extension is at the court's discretion and not guaranteed.",
    },
  ];

  // Set-aside route depends on how the judgment came about.
  if (c.judgment?.basis === "default") {
    tools.push({
      id: "set-aside-default-13-3",
      title: "Apply to set aside the default judgment (CPR 13.3)",
      category: "court",
      priority: 2,
      legalBasis: "CPR 13.3 (set aside default judgment — real prospect of success / good reason)",
      deadline: k.applyBy,
      deadlineBasis: `Apply PROMPTLY — the court weighs promptness heavily (by ${formatUK(k.applyBy)}).`,
      nextAction:
        "Apply on Form N244 to set aside the default judgment under CPR 13.3, showing a real prospect of " +
        "successfully defending/pursuing the claim or some other good reason, and explaining why you act now.",
      documentTemplate: setAsideTemplate(c, k),
    });
  } else if (c.judgment?.basis === "non_attendance") {
    tools.push({
      id: "set-aside-non-attendance-39-3",
      title: "Apply to set aside the order for non-attendance (CPR 39.3)",
      category: "court",
      priority: 2,
      legalBasis: "CPR 39.3 (set aside where a party failed to attend — three-part test)",
      deadline: k.setAsideLongstop ?? k.applyBy,
      deadlineBasis: `Apply PROMPTLY — within 14 days of the order (by ${formatUK(k.setAsideLongstop ?? k.applyBy)}).`,
      nextAction:
        "Apply on Form N244 to set aside under CPR 39.3, showing you acted promptly, had a good reason for " +
        "not attending, and have a reasonable prospect of success at a re-hearing.",
      documentTemplate: setAsideTemplate(c, k),
    });
  } else {
    // Decided on the merits (or unknown): set-aside is unlikely; appeal is the route.
    tools.push({
      id: "assess-set-aside-availability",
      title: "Check whether set-aside is available (CPR 13.3 / 39.3)",
      category: "evidence",
      priority: 2,
      legalBasis: "CPR 13.3 (default) / CPR 39.3 (non-attendance)",
      deadline: k.applyBy,
      deadlineBasis: `Decide quickly — set-aside must also be prompt (by ${formatUK(k.applyBy)}).`,
      nextAction:
        "Confirm how the order was made: set-aside is available if it was a default judgment (CPR 13.3) or " +
        "made because a party did not attend (CPR 39.3). If it was decided on the merits, the route is appeal, " +
        "not set-aside.",
    });
  }

  tools.push({
    id: "request-judgment-transcript",
    title: "Obtain the judgment / reasons to ground any appeal",
    category: "evidence",
    priority: 3,
    legalBasis: "CPR Part 52; PD 52B (documents required for an appeal)",
    deadline: k.appealLongstop ?? k.applyBy,
    deadlineBasis: "Needed to draft grounds of appeal within the 21-day window.",
    nextAction:
      "Request a transcript or note of the judge's reasons and review them for an error of law or a finding " +
      "no reasonable judge could have reached — the basis for grounds of appeal.",
  });

  return tools;
};

/* ------------------------------------------------------------------ *
 * Branch C — ON_TRACK
 * No breach. Keep the timetable: comply with the next directions step and sort
 * out the single joint expert so causation is properly evidenced.
 * ------------------------------------------------------------------ */
const onTrack: ToolBuilder = (c, k) => {
  const next = k.nextDirectionsStep;
  return [
    {
      id: "comply-next-directions-step",
      title: next ? `Comply with the next directions step: ${next.step}` : "Comply with the directions order",
      category: "evidence",
      priority: 1,
      legalBasis: "The court directions order; CPR Part 27 (small-claims track)",
      deadline: next?.date ?? k.applyBy,
      deadlineBasis: next
        ? `Directions deadline for "${next.step}" (${formatUK(next.date)}).`
        : "Keep to the directions timetable.",
      nextAction: next
        ? `Prepare and serve "${next.step}" so it is filed at ${c.court} and served on ` +
          `${defendantContact(c)} by ${formatUK(next.date)}. Diarise it — missing it would trigger a sanction.`
        : `Review the directions order and diarise every remaining deadline, filing at ${c.court} on time.`,
    },
    {
      id: "agree-single-joint-expert",
      title: "Agree a single joint expert on causation (CPR 35.7)",
      category: "evidence",
      priority: 2,
      legalBasis: "CPR 35.4 (permission for expert evidence); CPR 35.7 (single joint expert)",
      deadline: next?.date ?? k.applyBy,
      deadlineBasis: "Causation in tree-root nuisance usually needs expert evidence — agree it early.",
      nextAction:
        `Causation (that the roots — not clay-soil settlement or the wall's age — caused the damage) is the ` +
        `live issue. Agree a single joint expert (a chartered arboriculturist) under CPR 35.7, share the fee, ` +
        `and seek the court's permission under CPR 35.4. The ${money(c.nuisance.remedialCost)} builder's quote ` +
        `proves cost, not causation.`,
    },
    {
      id: "consider-adr",
      title: "Consider settlement / ADR",
      category: "adr",
      priority: 3,
      legalBasis: "The directions order (parties must consider ADR at all stages)",
      deadline: k.finalHearingDate ?? next?.date ?? k.applyBy,
      deadlineBasis: "The order requires the parties to consider ADR throughout; do so before the hearing.",
      nextAction:
        "Explore mediation or a negotiated settlement (e.g. the Defendant funding a root barrier and a " +
        "contribution to remedial costs). Settling avoids the cost and causation risk of the final hearing.",
    },
  ];
};

const BUILDERS: Record<SmallClaimsNuisanceBranch, ToolBuilder> = {
  MISSED_DIRECTIONS_DEADLINE: missedDirectionsDeadline,
  JUDGMENT_ENTERED: judgmentEntered,
  ON_TRACK: onTrack,
};

/** Returns the matched, priority-ordered toolset for a branch. */
export function buildToolsForBranch(
  branch: SmallClaimsNuisanceBranch,
  c: SmallClaimsNuisanceCase,
  k: KeyDates,
): Tool[] {
  return BUILDERS[branch](c, k).sort((a, b) => a.priority - b.priority);
}

/* ------------------------------------------------------------------ *
 * Document templates (litigant-in-person drafting aids). These are skeletons to
 * adapt with a solicitor — given live proceedings, the playbook urges getting
 * advice rather than relying on these alone.
 * ------------------------------------------------------------------ */

/** Witness statement in support of a CPR 3.9 relief-from-sanctions application. */
function reliefApplicationTemplate(c: SmallClaimsNuisanceCase, k: KeyDates): string {
  const step = c.missedDeadline?.step ?? "the required document";
  const missedOn = k.missedDeadlineDate ? formatUK(k.missedDeadlineDate) : "[date]";

  return [
    `IN THE ${c.court.toUpperCase()}`,
    `Claim No. ${c.caseNumber}`,
    `BETWEEN ${c.claimant.name} (Claimant) and ${c.defendant.name} (Defendant)`,
    ``,
    `WITNESS STATEMENT IN SUPPORT OF APPLICATION FOR RELIEF FROM SANCTIONS (CPR 3.9)`,
    ``,
    `1. I make this statement in support of my application on Form N244 for relief from sanctions under`,
    `   CPR 3.9 so that I may rely on my ${step}, which was due by ${missedOn} and served late.`,
    ``,
    `2. Seriousness/significance (Denton stage 1): [explain the effect of the delay — e.g. whether it`,
    `   disrupted the hearing or other deadlines. The ${step} has now been filed and served.]`,
    ``,
    `3. Reason for the default (Denton stage 2): [explain why the deadline was missed — e.g. ill health,`,
    `   misunderstanding of the order as a litigant in person, postal/administrative failure.]`,
    ``,
    `4. All the circumstances (Denton stage 3): [the need for litigation to be conducted efficiently and`,
    `   at proportionate cost, and the need to enforce compliance, weighed against the strength of the`,
    `   claim, the modest sum in issue (${money(c.nuisance.remedialCost)}), and the prejudice to each party.]`,
    ``,
    `5. I respectfully ask the court to grant relief so the ${step} may stand.`,
    ``,
    `Statement of truth: I believe the facts stated in this witness statement are true.`,
    `Signed: ${c.claimant.name}    Dated: ${formatUK(k.evaluationDate)}`,
  ].join("\n");
}

/** Witness statement in support of a set-aside application (CPR 13.3 / 39.3). */
function setAsideTemplate(c: SmallClaimsNuisanceCase, k: KeyDates): string {
  const madeOn = k.judgmentDate ? formatUK(k.judgmentDate) : "[date]";
  const rule = c.judgment?.basis === "non_attendance" ? "CPR 39.3" : "CPR 13.3";

  return [
    `IN THE ${c.court.toUpperCase()}`,
    `Claim No. ${c.caseNumber}`,
    `BETWEEN ${c.claimant.name} (Claimant) and ${c.defendant.name} (Defendant)`,
    ``,
    `WITNESS STATEMENT IN SUPPORT OF APPLICATION TO SET ASIDE (${rule})`,
    ``,
    `1. I apply on Form N244 to set aside the order made on ${madeOn}` +
      (c.judgment?.outcome ? ` (${c.judgment.outcome}).` : "."),
    ``,
    rule === "CPR 39.3"
      ? `2. I acted promptly on learning of the order; I had a good reason for not attending the hearing,`
      : `2. I have a real prospect of success and I have acted promptly,`,
    rule === "CPR 39.3"
      ? `   namely [reason]; and I have a reasonable prospect of success at a re-hearing.`
      : `   namely [reason for not engaging in time]; alternatively there is good reason to set the order aside.`,
    ``,
    `3. The claim concerns ${c.nuisance.description}, with remedial cost of ${money(c.nuisance.remedialCost)}.`,
    ``,
    `4. I respectfully ask the court to set aside the order and give directions for the claim to proceed.`,
    ``,
    `Statement of truth: I believe the facts stated in this witness statement are true.`,
    `Signed: ${c.claimant.name}    Dated: ${formatUK(k.evaluationDate)}`,
  ].join("\n");
}
