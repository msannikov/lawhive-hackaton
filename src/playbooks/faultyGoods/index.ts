/**
 * Faulty-goods playbook (UK Consumer Rights Act 2015).
 *
 * Bundles the faulty-goods extraction schema, validator, decision tree and tools
 * arsenal behind the generic {@link Playbook} interface. The running example is a
 * faulty used car bought from a dealer; the same logic fits any GOODS bought from
 * a trader. The `assess` function is the deterministic rules engine.
 *
 * Legal essence: CRA 2015 ss9–11 (satisfactory quality / fit for purpose / as
 * described); s20 & s22 short-term right to reject within 30 days of ownership
 * (full refund); s23 right to repair or replacement; s24 price reduction or final
 * right to reject after one failed repair. Rights apply because the seller is a
 * TRADER. Within 6 months the fault is presumed present at purchase. Limitation
 * 6 years. ADR via the Motor Ombudsman; otherwise County Court small claims.
 */

import type { Playbook, CaseAssessment, EscalationSignal } from "../../core/types.ts";
import type { FaultyGoodsCase, FaultyGoodsBranch } from "./case.ts";
import {
  faultyGoodsJsonSchema,
  faultyGoodsGeminiSchema,
  EXTRACTION_INSTRUCTIONS,
} from "./schema.ts";
import { normalizeFaultyGoodsCase } from "./normalize.ts";
import { classify, BRANCH_LABELS } from "./decisionTree.ts";
import { computeKeyDates } from "./keyDates.ts";
import { buildToolsForBranch } from "./toolsArsenal.ts";
import { formatUK } from "../../core/dates.ts";
import { buildNextMove } from "../../core/negotiation.ts";

/**
 * The decision gate. Negotiation = gather information before deciding; the user
 * stays self-serve while a calibrated letter/rejection can still move things, and
 * only escalates to a human lawyer once that information-gathering is exhausted
 * (the user reports back a later `negotiationStage`).
 */
function escalationFor(c: FaultyGoodsCase, branch: FaultyGoodsBranch): EscalationSignal {
  const stage = c.negotiationStage ?? "initial";

  // A private seller falls outside the CRA satisfactory-quality regime — the
  // analysis is materially different, so flag for advice regardless of stage.
  if (c.sellerType === "private") {
    return {
      level: "escalate",
      recommend: true,
      reason:
        "Seller appears to be a private individual — the CRA 2015 satisfactory-quality rights do not apply; a lawyer should review whether a misrepresentation or 'as described' claim exists.",
      triggers: ["private_seller", "cra_may_not_apply"],
    };
  }

  switch (branch) {
    case "WITHIN_30_DAYS":
      return {
        level: "self_serve",
        recommend: false,
        reason:
          "You have a clear short-term right to reject for a full refund — handle it yourself; just reject in writing before the 30-day window closes.",
        triggers: ["watch:reject_window"],
      };

    case "REPAIR_OR_REPLACE":
      if (stage === "post_lbc" || stage === "post_adr")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "The repair/replacement route and pre-action steps are exhausted without resolution — a lawyer can advise on issuing the County Court claim.",
          triggers: ["remedy_exhausted"],
        };
      return {
        level: "monitor",
        recommend: false,
        reason:
          "Require the free repair or replacement yourself. Escalate only if the one repair fails (the s24 remedies then open) or the value is high.",
        triggers: ["watch:repair_outcome"],
      };

    case "FINAL_RIGHT_TO_REJECT":
      if (stage !== "initial")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "A repair already failed and the trader has not refunded after your rejection/letter — bring in a lawyer before issuing the claim (deduction-for-use and condition arguments can be technical).",
          triggers: ["repair_failed", "no_refund_after_letter"],
        };
      return {
        level: "monitor",
        recommend: false,
        reason:
          "Exercise the final right to reject in writing yourself first. If the trader does not refund, escalate to the Letter Before Claim and consider a lawyer before court.",
        triggers: ["watch:before_lbc"],
      };

    case "DEALER_REFUSES":
    default:
      if (stage === "post_adr")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "Motor Ombudsman ADR did not resolve the dispute — a lawyer can advise on the County Court claim.",
          triggers: ["adr_exhausted"],
        };
      if (stage !== "initial")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "The trader refused/stayed silent after your Letter Before Claim — information-gathering is exhausted; escalate to Motor Ombudsman ADR or court, or a lawyer.",
          triggers: ["no_response_after_lbc"],
        };
      return {
        level: "monitor",
        recommend: false,
        reason:
          "Send the calibrated Letter Before Claim yourself to surface the trader's position, then use the free Motor Ombudsman ADR. Bring in a lawyer before issuing a court claim.",
        triggers: ["watch:before_adr_or_court"],
      };
  }
}

function assess(c: FaultyGoodsCase): CaseAssessment {
  const k = computeKeyDates(c);
  const { branch, reasoning } = classify(c);
  const tools = buildToolsForBranch(branch, c, k);

  const keyDates: Record<string, string> = {
    "Purchase / ownership date": formatUK(k.purchaseDate),
    "30-day right-to-reject deadline": formatUK(k.rejectWindowEnd),
  };
  if (k.faultAppearedDate) keyDates["Fault appeared"] = formatUK(k.faultAppearedDate);
  if (branch !== "WITHIN_30_DAYS") {
    keyDates["Letter Before Claim by"] = formatUK(k.letterBeforeClaimSendBy);
    keyDates["LBC response deadline"] = formatUK(k.letterBeforeClaimResponseDeadline);
  }
  keyDates["6-year limitation longstop"] = formatUK(k.claimLimitationLongstop);

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

export const faultyGoodsPlaybook: Playbook<FaultyGoodsCase> = {
  id: "faulty_goods",
  label: "UK faulty goods (Consumer Rights Act 2015)",
  extraction: {
    instructions: EXTRACTION_INSTRUCTIONS,
    jsonSchema: faultyGoodsJsonSchema as unknown as Record<string, unknown>,
    geminiSchema: faultyGoodsGeminiSchema,
  },
  normalize: (raw, input, warnings) => normalizeFaultyGoodsCase(raw, input, warnings),
  assess,
};
