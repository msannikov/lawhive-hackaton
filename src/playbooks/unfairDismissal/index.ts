/**
 * Unfair-dismissal + discrimination playbook (England & Wales).
 *
 * A RICHER sibling of the employment-termination stub, built for the case where
 * a redundancy is used as a cover for sex discrimination: ACAS Early
 * Conciliation is complete, and a settlement offer is on the table. It bundles
 * the domain extraction schema, validator, decision tree and tools arsenal
 * behind the generic {@link Playbook} interface; `assess` is the deterministic
 * rules engine.
 *
 * Posture: tribunal deadlines are strict (a day late is normally fatal) and a
 * live offer must be judged against the claim's value, so this playbook leans
 * toward monitor/escalate with a clear recommendation to take specialist advice
 * BEFORE lodging the ET1 or accepting any offer.
 */

import type { Playbook, CaseAssessment, EscalationSignal } from "../../core/types.ts";
import type { UnfairDismissalCase, UnfairDismissalBranch } from "./case.ts";
import {
  unfairDismissalJsonSchema,
  unfairDismissalGeminiSchema,
  EXTRACTION_INSTRUCTIONS,
} from "./schema.ts";
import { normalizeUnfairDismissalCase } from "./normalize.ts";
import { classify, BRANCH_LABELS } from "./decisionTree.ts";
import { computeKeyDates } from "./keyDates.ts";
import { buildToolsForBranch } from "./toolsArsenal.ts";
import { formatUK, parseISO } from "../../core/dates.ts";
import { buildNextMove } from "../../core/negotiation.ts";

/**
 * The decision gate. Negotiation = gather information before deciding; but a
 * tribunal claim is the irreversible, strictly time-limited step, and a live
 * settlement offer is a decision that should not be made blind. So this domain
 * stays at "monitor" while there is still room to value the claim / improve the
 * offer, and reaches "escalate" once that work is due (a live offer to decide,
 * or the user reporting back a later `negotiationStage`). It never sits at
 * "self_serve" for a genuine claim — specialist advice is always recommended
 * before the ET1 or acceptance.
 */
function escalationFor(c: UnfairDismissalCase, branch: UnfairDismissalBranch): EscalationSignal {
  const stage = c.negotiationStage ?? "initial";
  const offerLive = c.settlement.offered;

  if (branch === "REVIEW_NEEDED") {
    return {
      level: "escalate",
      recommend: true,
      reason:
        "Key facts (notably the effective date of termination) are missing, so the strict 3-month " +
        "ET1 limit cannot be safely computed — a specialist should review now before any deadline passes.",
      triggers: ["incomplete_facts", "deadline_risk"],
    };
  }

  // Once the ET1 has been presented, the litigation is live → lawyer territory.
  if (stage === "post_et1") {
    return {
      level: "escalate",
      recommend: true,
      reason:
        "An ET1 has been presented — the claim is now in the tribunal process; a specialist should " +
        "conduct it (case management, schedule of loss, hearing).",
      triggers: ["et1_presented"],
    };
  }

  if (branch === "DISCRIMINATION_CLAIM") {
    return {
      level: "escalate",
      recommend: true,
      reason:
        "A discrimination claim (no qualifying period, uncapped + injury to feelings) combined with " +
        (offerLive ? "a live settlement offer " : "") +
        "and a strict ET1 deadline is high-value and technical — get specialist advice before lodging " +
        "the ET1 or accepting any offer.",
      triggers: offerLive
        ? ["discrimination_claim", "live_settlement_offer", "before_et1"]
        : ["discrimination_claim", "before_et1"],
    };
  }

  if (branch === "SETTLEMENT_DECISION") {
    return {
      level: "escalate",
      recommend: true,
      reason:
        "A settlement offer is on the table and the decision must be made before it lapses and before the " +
        "ET1 limit — have a specialist value the claim and check the settlement terms before you accept.",
      triggers: ["live_settlement_offer", "before_settlement_decision"],
    };
  }

  // UNFAIR_DISMISSAL: if an offer is live, the decision is due → escalate;
  // otherwise monitor while the claim is valued, but still recommend advice.
  if (offerLive) {
    return {
      level: "escalate",
      recommend: true,
      reason:
        "An unfair-dismissal claim with a live settlement offer and a strict ET1 deadline — take " +
        "specialist advice to value the claim and check the settlement before accepting or lodging the ET1.",
      triggers: ["live_settlement_offer", "before_et1"],
    };
  }
  return {
    level: "monitor",
    recommend: false,
    reason:
      "Gather the evidence and value the claim yourself, but bring in a specialist before lodging the ET1 — " +
      "the 3-month tribunal limit is strict and a redundancy-fairness claim is fact-sensitive.",
    triggers: ["watch:before_et1"],
  };
}

function assess(c: UnfairDismissalCase): CaseAssessment {
  const k = computeKeyDates(c);
  const { branch, reasoning } = classify(c);
  const tools = buildToolsForBranch(branch, c, k);

  const keyDates: Record<string, string> = {
    "Continuous service start": formatUK(k.startDate),
  };
  if (k.endDate) keyDates["Dismissal date (EDT)"] = formatUK(k.endDate);
  if (c.dismissal.noticeDate) keyDates["Dismissal letter"] = formatUK(parseISO(c.dismissal.noticeDate));
  if (k.acasDayA) keyDates["ACAS EC notified (Day A)"] = formatUK(k.acasDayA);
  if (k.acasDayB) keyDates["ACAS EC certificate (Day B)"] = formatUK(k.acasDayB);
  keyDates["Primary ET1 limit (EDT + 3m − 1d)"] = formatUK(k.primaryEtLimit);
  keyDates["ET1 limit (ACAS-adjusted)"] = formatUK(k.etLimit);
  if (c.settlement.offered)
    keyDates["Settlement decision by"] = formatUK(k.settlementDecideBy);

  const escalation = escalationFor(c, branch);
  const nextMove = buildNextMove(tools, escalation.recommend);

  const summary =
    `Matched branch "${BRANCH_LABELS[branch]}" (${escalation.level}) with ${tools.length} tool(s). ` +
    `ET1 limit: ${formatUK(k.etLimit)}` +
    (c.settlement.offered ? `; settlement decision by ${formatUK(k.settlementDecideBy)}.` : ".") +
    ` Next move: ${nextMove?.title ?? "none"}`;

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

export const unfairDismissalPlaybook: Playbook<UnfairDismissalCase> = {
  id: "unfair_dismissal",
  label: "UK unfair dismissal + sex discrimination",
  extraction: {
    instructions: EXTRACTION_INSTRUCTIONS,
    jsonSchema: unfairDismissalJsonSchema as unknown as Record<string, unknown>,
    geminiSchema: unfairDismissalGeminiSchema,
  },
  normalize: (raw, input, warnings) => normalizeUnfairDismissalCase(raw, input, warnings),
  assess,
};
