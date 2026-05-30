/**
 * Small-claims private-nuisance playbook: mid-litigation procedural recovery.
 *
 * The vertical is a private-nuisance claim (encroaching tree roots causing
 * property damage; measure of loss = reasonable remedial cost) that is ALREADY
 * IN PROCEEDINGS on the small-claims track under the Civil Procedure Rules. This
 * is NOT about starting a claim — it is about the time-critical PROCEDURAL steps
 * when a court directions deadline has been missed or a judgment has been made:
 *   - relief from sanctions (CPR 3.9 / Denton v TH White) — must be PROMPT;
 *   - set-aside (CPR 13.3 default judgment, CPR 39.3 non-attendance) — PROMPT;
 *   - appeal (Appellant's Notice within 21 days of the decision, CPR 52.12).
 *
 * Because the matter is live before the court and these steps are technical and
 * strictly time-limited, the playbook leans toward ESCALATE: instruct a
 * solicitor urgently.
 */

import type { Playbook, CaseAssessment, EscalationSignal } from "../../core/types.ts";
import type { SmallClaimsNuisanceCase, SmallClaimsNuisanceBranch } from "./case.ts";
import {
  nuisanceCaseJsonSchema,
  nuisanceCaseGeminiSchema,
  EXTRACTION_INSTRUCTIONS,
} from "./schema.ts";
import { normalizeSmallClaimsNuisanceCase } from "./normalize.ts";
import { classify, BRANCH_LABELS } from "./decisionTree.ts";
import { computeKeyDates } from "./keyDates.ts";
import { buildToolsForBranch } from "./toolsArsenal.ts";
import { formatUK } from "../../core/dates.ts";
import { buildNextMove } from "../../core/negotiation.ts";

/**
 * The decision gate. In normal negotiation playbooks the user stays self-serve
 * while a calibrated letter can still move things. Here the matter is LIVE before
 * the court on strict CPR deadlines, so the baseline is to ESCALATE — the
 * applications (relief/set-aside/appeal) are technical and a missed deadline is
 * usually fatal. The only non-escalate posture is ON_TRACK before any breach.
 */
function escalationFor(c: SmallClaimsNuisanceCase, branch: SmallClaimsNuisanceBranch): EscalationSignal {
  switch (branch) {
    case "JUDGMENT_ENTERED":
      return {
        level: "escalate",
        recommend: true,
        reason:
          "A judgment/order is in force and the appeal window is only 21 days from the decision (CPR 52.12). " +
          "Set-aside and appeal are technical and time-critical — instruct a solicitor urgently.",
        triggers: ["judgment_entered", "appeal_21_day_limit", "set_aside_must_be_prompt"],
      };

    case "MISSED_DIRECTIONS_DEADLINE":
      return {
        level: "escalate",
        recommend: true,
        reason:
          "A court directions deadline was missed, so a sanction may bite (e.g. CPR 32.10 bars late witness " +
          "evidence). Relief from sanctions under CPR 3.9 / Denton must be applied for PROMPTLY and argued well — " +
          "instruct a solicitor urgently while filing the outstanding document now.",
        triggers: ["missed_directions_deadline", "relief_must_be_prompt", "denton_test"],
      };

    case "ON_TRACK":
    default:
      // No breach yet. The user can keep the timetable themselves, but the
      // moment a deadline slips this flips to escalate, so flag it for monitoring.
      if ((c.negotiationStage ?? "initial") !== "initial")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "The matter remains live before the court — once you have engaged the process, a solicitor should " +
            "review compliance and the single-joint-expert position, as deadlines are unforgiving.",
          triggers: ["live_proceedings", "watch:next_directions_deadline"],
        };
      return {
        level: "monitor",
        recommend: false,
        reason:
          "No breach yet — keep to the directions timetable yourself and agree a single joint expert on causation. " +
          "Escalate to a solicitor immediately if a deadline is at risk or an order is made against you.",
        triggers: ["watch:next_directions_deadline", "watch:causation_evidence"],
      };
  }
}

function assess(c: SmallClaimsNuisanceCase): CaseAssessment {
  const k = computeKeyDates(c);
  const { branch, reasoning } = classify(c);
  const tools = buildToolsForBranch(branch, c, k);

  const keyDates: Record<string, string> = {};
  if (k.orderDate) keyDates["Directions order"] = formatUK(k.orderDate);
  if (k.missedDeadlineDate)
    keyDates[`Missed: ${c.missedDeadline?.step ?? "deadline"}`] = formatUK(k.missedDeadlineDate);
  if (branch === "MISSED_DIRECTIONS_DEADLINE")
    keyDates["Apply for relief (CPR 3.9) by"] = formatUK(k.applyBy);
  if (k.judgmentDate) keyDates["Judgment/order made"] = formatUK(k.judgmentDate);
  if (k.appealLongstop) keyDates["Appeal longstop (21 days, CPR 52.12)"] = formatUK(k.appealLongstop);
  if (branch === "JUDGMENT_ENTERED" && c.judgment?.basis === "non_attendance" && k.setAsideLongstop)
    keyDates["Set-aside longstop (CPR 39.3, 14 days)"] = formatUK(k.setAsideLongstop);
  if (k.nextDirectionsStep)
    keyDates[`Next: ${k.nextDirectionsStep.step}`] = formatUK(k.nextDirectionsStep.date);
  if (k.finalHearingDate) keyDates["Final hearing"] = formatUK(k.finalHearingDate);

  const escalation = escalationFor(c, branch);
  const nextMove = buildNextMove(tools, escalation.recommend);

  const summary =
    `Matched branch "${BRANCH_LABELS[branch]}" (${escalation.level}) with ${tools.length} tool(s). ` +
    `Next move: ${nextMove?.title ?? "none"}` +
    (k.appealLongstop ? `. Appeal longstop: ${formatUK(k.appealLongstop)}.` : ".");

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

export const smallClaimsNuisancePlaybook: Playbook<SmallClaimsNuisanceCase> = {
  id: "small_claims_nuisance",
  label: "UK small-claims private nuisance (tree-root encroachment, mid-litigation)",
  extraction: {
    instructions: EXTRACTION_INSTRUCTIONS,
    jsonSchema: nuisanceCaseJsonSchema as unknown as Record<string, unknown>,
    geminiSchema: nuisanceCaseGeminiSchema,
  },
  normalize: (raw, input, warnings) => normalizeSmallClaimsNuisanceCase(raw, input, warnings),
  assess,
};
