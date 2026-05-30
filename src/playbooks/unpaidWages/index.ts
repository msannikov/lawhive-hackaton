/**
 * Unpaid-wages playbook: UK employment — unauthorised deduction from wages /
 * withheld commission.
 *
 * Bundles the unpaid-wages extraction schema, validator, decision tree and
 * tools arsenal behind the generic {@link Playbook} interface. `assess` is the
 * deterministic rules engine.
 *
 * Legal essence: Employment Rights Act 1996 s13 — an employer must not make an
 * unauthorised DEDUCTION from wages; "wages" (s27) includes contractual
 * commission/bonus that has become payable. Remedy: grievance (ACAS Code) →
 * mandatory ACAS Early Conciliation → Employment Tribunal claim under s23 (or a
 * County Court breach-of-contract claim for the pure contract sums). The ET
 * limit is 3 months LESS 1 day from the deduction (or the last in a series);
 * ACAS Early Conciliation must be started before it and pauses the clock. ET
 * claims have no issue fee.
 */

import type { Playbook, CaseAssessment, EscalationSignal } from "../../core/types.ts";
import type { UnpaidWagesCase, UnpaidWagesBranch } from "./case.ts";
import {
  unpaidWagesJsonSchema,
  unpaidWagesGeminiSchema,
  EXTRACTION_INSTRUCTIONS,
} from "./schema.ts";
import { normalizeUnpaidWagesCase } from "./normalize.ts";
import { classify, BRANCH_LABELS } from "./decisionTree.ts";
import { computeKeyDates } from "./keyDates.ts";
import { buildToolsForBranch } from "./toolsArsenal.ts";
import { formatUK, isAfter, daysBetween } from "../../core/dates.ts";
import { buildNextMove } from "../../core/negotiation.ts";

/** Days from "today" to the ET limit at/under which the limit counts as "near". */
const LIMIT_NEAR_DAYS = 21;

/**
 * The decision gate. Negotiation = gather information before deciding; the user
 * stays self-serve while a grievance / demand can still move things, and only
 * escalates to a human lawyer once that information-gathering is exhausted (a
 * later `negotiationStage`), before the irreversible ET1, OR as the strict ET
 * limit nears — whichever comes first.
 */
function escalationFor(c: UnpaidWagesCase, branch: UnpaidWagesBranch): EscalationSignal {
  const stage = c.negotiationStage ?? "initial";
  const k = computeKeyDates(c);

  // The limit is unforgiving: if it's near or passed, get a lawyer now whatever
  // the branch — this overrides the normal self-serve posture.
  const daysToLimit = daysBetween(k.evaluationDate, k.etClaimLimit);
  if (isAfter(k.evaluationDate, k.etClaimLimit)) {
    return {
      level: "escalate",
      recommend: true,
      reason:
        `The Employment Tribunal limit (${formatUK(k.etClaimLimit)}) has passed — a lawyer should ` +
        "advise urgently on whether it can still be extended (the test is strict).",
      triggers: ["limit_passed"],
    };
  }
  if (daysToLimit <= LIMIT_NEAR_DAYS) {
    return {
      level: "escalate",
      recommend: true,
      reason:
        `The ET limit (${formatUK(k.etClaimLimit)}) is only ${daysToLimit} day(s) away — start ACAS ` +
        "Early Conciliation immediately and get a lawyer to review before the deadline bites.",
      triggers: ["limit_near", "watch:before_et1"],
    };
  }

  switch (branch) {
    case "EMPLOYER_ENGAGING":
      return {
        level: "self_serve",
        recommend: false,
        reason:
          "The employer is engaging — settle it yourself in writing, but diary the ACAS/ET deadline " +
          "as a fallback in case payment doesn't arrive.",
        triggers: ["watch:payment_arrives"],
      };

    case "DISPUTED_COMMISSION":
      if (stage === "post_acas")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "ACAS Early Conciliation did not resolve the disputed commission — get a lawyer to review " +
            "before lodging the ET1, as discretionary-commission disputes turn on the contract wording.",
          triggers: ["acas_exhausted", "watch:before_et1"],
        };
      return {
        level: "monitor",
        recommend: false,
        reason:
          "Assemble the contract/commission evidence and use the free ACAS Early Conciliation first. " +
          "Bring in a lawyer before lodging the ET1 if the dispute isn't resolved.",
        triggers: ["watch:acas_outcome", "watch:before_et1"],
      };

    case "UNLAWFUL_DEDUCTION":
    default:
      if (stage === "post_acas")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "Grievance and ACAS Early Conciliation are exhausted with no payment — this is the decision " +
            "step; get a lawyer to lodge the ET1 (or a County Court breach-of-contract claim).",
          triggers: ["acas_exhausted", "watch:before_et1"],
        };
      if (stage === "post_grievance")
        return {
          level: "monitor",
          recommend: false,
          reason:
            "Grievance raised but unpaid — start mandatory ACAS Early Conciliation now (free, pauses the " +
            "clock). Escalate to a lawyer before lodging the ET1.",
          triggers: ["watch:acas_outcome", "watch:before_et1"],
        };
      return {
        level: "monitor",
        recommend: false,
        reason:
          "The sum is clearly due. Raise a written grievance and start ACAS Early Conciliation yourself " +
          "to surface the employer's position. Bring in a lawyer before lodging the ET1.",
        triggers: ["watch:employer_response", "watch:before_et1"],
      };
  }
}

function assess(c: UnpaidWagesCase): CaseAssessment {
  const k = computeKeyDates(c);
  const { branch, reasoning } = classify(c);
  const tools = buildToolsForBranch(branch, c, k);

  const keyDates: Record<string, string> = {
    "Deduction (wages due)": formatUK(k.deductionDate),
    "ACAS Early Conciliation by": formatUK(k.acasStartBy),
    "ET claim limit (3 months − 1 day)": formatUK(k.etClaimLimit),
  };
  if (branch !== "EMPLOYER_ENGAGING")
    keyDates["Raise grievance by"] = formatUK(k.grievanceRaiseBy);

  const escalation = escalationFor(c, branch);
  const nextMove = buildNextMove(tools, escalation.recommend);

  const summary =
    `Matched branch "${BRANCH_LABELS[branch]}" (${escalation.level}) with ${tools.length} tool(s). ` +
    `ET limit: ${formatUK(k.etClaimLimit)}. Next move: ${nextMove?.title ?? "none"}`;

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

export const unpaidWagesPlaybook: Playbook<UnpaidWagesCase> = {
  id: "unpaid_wages",
  label: "UK unpaid wages / withheld commission",
  extraction: {
    instructions: EXTRACTION_INSTRUCTIONS,
    jsonSchema: unpaidWagesJsonSchema as unknown as Record<string, unknown>,
    geminiSchema: unpaidWagesGeminiSchema,
  },
  normalize: (raw, input, warnings) => normalizeUnpaidWagesCase(raw, input, warnings),
  assess,
};
