/**
 * Building-dispute playbook: a UK contract dispute over building /
 * home-improvement work that was abandoned, left incomplete or done defectively.
 *
 * Bundles the building-dispute extraction schema, validator, decision tree and
 * tools arsenal behind the generic {@link Playbook} interface. The `assess`
 * function is the deterministic rules engine: facts → branch + dated toolset.
 *
 * Legal essence: breach of contract; where the customer is a consumer, the
 * Consumer Rights Act 2015 requires services performed with reasonable care and
 * skill (s49) and within a reasonable time (s52). Damages are normally the
 * reasonable cost of completing or remedying the work (evidenced by a remedial
 * contractor's quote/invoice), less any unpaid balance, subject to the duty to
 * mitigate. Limitation is 6 years from breach.
 */

import type { Playbook, CaseAssessment, EscalationSignal } from "../../core/types.ts";
import type { BuildingDisputeCase, BuildingDisputeBranch } from "./case.ts";
import {
  buildingDisputeJsonSchema,
  buildingDisputeGeminiSchema,
  EXTRACTION_INSTRUCTIONS,
} from "./schema.ts";
import { normalizeBuildingDisputeCase } from "./normalize.ts";
import { classify, BRANCH_LABELS } from "./decisionTree.ts";
import { computeKeyDates, recoverableLoss } from "./keyDates.ts";
import { buildToolsForBranch } from "./toolsArsenal.ts";
import { formatUK } from "../../core/dates.ts";
import { buildNextMove } from "../../core/negotiation.ts";

const money = (n: number) => `£${n.toFixed(2)}`;

/**
 * The decision gate. Negotiation = gather information before deciding; the user
 * stays self-serve while a calibrated Letter Before Claim can still move things,
 * and only escalates to a human lawyer once that information-gathering is
 * exhausted (the user reports back a later `negotiationStage`) or the stakes are
 * high (a £10k+ loss puts the claim outside the small claims track).
 */
function escalationFor(c: BuildingDisputeCase, branch: BuildingDisputeBranch): EscalationSignal {
  const stage = c.negotiationStage ?? "initial";
  const highValue = recoverableLoss(c) >= 10000;

  switch (branch) {
    case "CONTRACTOR_THREATENING":
      if (stage !== "initial")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "The contractor kept up the threats after your Letter Before Claim — get a lawyer to " +
            "issue the County Court claim, and consider reporting the harassment to the police.",
          triggers: ["harassment", "no_resolution_after_lbc"],
        };
      return {
        level: "monitor",
        recommend: false,
        reason:
          "Preserve the abusive messages and send a firm Letter Before Claim yourself. Escalate " +
          "to a lawyer (and consider reporting under the Protection from Harassment Act 1997) if " +
          "the threats continue or the matter is not resolved.",
        triggers: ["watch:harassment", "watch:before_court_filing"],
      };

    case "NEGOTIATING":
      if (stage === "post_lbc")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "Negotiations have run their course without a settlement — a lawyer can advise on a " +
            "County Court claim for the remedial cost.",
          triggers: ["negotiation_exhausted"],
        };
      return {
        level: "self_serve",
        recommend: false,
        reason:
          "The contractor is engaging — negotiate a settlement for the remedial cost yourself. " +
          "Escalate only if talks break down or the sum is high-value or complex.",
        triggers: ["watch:settlement_outcome"],
      };

    case "INCOMPLETE_OR_DEFECTIVE":
    default:
      if (stage !== "initial")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "No resolution after your Letter Before Claim — information-gathering is exhausted; " +
            "get a lawyer to issue the County Court claim for the cost of completing the work.",
          triggers: ["no_resolution_after_lbc"],
        };
      if (highValue)
        return {
          level: "monitor",
          recommend: false,
          reason:
            "Send the calibrated Letter Before Claim yourself, but the remedial cost is £10,000+ " +
            "(outside the small claims track) — have a lawyer review before you issue a claim.",
          triggers: ["watch:before_court_filing", "above_small_claims_limit"],
        };
      return {
        level: "monitor",
        recommend: false,
        reason:
          "Send the calibrated Letter Before Claim yourself to surface the contractor's position. " +
          "If it isn't resolved, a low-value claim can be issued via the small claims track; " +
          "escalate if it becomes complex or high-value.",
        triggers: ["watch:before_court_filing"],
      };
  }
}

function assess(c: BuildingDisputeCase): CaseAssessment {
  const k = computeKeyDates(c);
  const { branch, reasoning } = classify(c);
  const tools = buildToolsForBranch(branch, c, k);

  const keyDates: Record<string, string> = {
    "Quantify the loss by": formatUK(k.quantifyLossBy),
    "Send Letter Before Claim by": formatUK(k.letterBeforeClaimSendBy),
    "LBC response deadline": formatUK(k.letterBeforeClaimResponseDeadline),
    "Earliest to issue County Court claim": formatUK(k.issueClaimBy),
    "Limitation longstop (6 yrs from breach)": formatUK(k.claimLimitationLongstop),
  };
  if (c.breachDate) keyDates["Breach / abandonment"] = formatUK(k.breachDate);

  const escalation = escalationFor(c, branch);
  const nextMove = buildNextMove(tools, escalation.recommend);

  const summary =
    `Matched branch "${BRANCH_LABELS[branch]}" (${escalation.level}) with ${tools.length} tool(s). ` +
    `Loss ~${money(recoverableLoss(c))}. Next move: ${nextMove?.title ?? "none"}`;

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

export const buildingDisputePlaybook: Playbook<BuildingDisputeCase> = {
  id: "building_dispute",
  label: "UK building / home-improvement contract dispute",
  extraction: {
    instructions: EXTRACTION_INSTRUCTIONS,
    jsonSchema: buildingDisputeJsonSchema as unknown as Record<string, unknown>,
    geminiSchema: buildingDisputeGeminiSchema,
  },
  normalize: (raw, input, warnings) => normalizeBuildingDisputeCase(raw, input, warnings),
  assess,
};
