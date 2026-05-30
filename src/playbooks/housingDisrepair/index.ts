/**
 * Housing-disrepair playbook: persistent damp / mould in a council or social
 * tenancy (a second housing/tenant vertical alongside deposit return).
 *
 * Bundles the disrepair-specific extraction schema, validator, decision tree and
 * tools arsenal behind the generic {@link Playbook} interface. The `assess`
 * function is the deterministic rules engine.
 *
 * Legal spine: Landlord and Tenant Act 1985 s11 (repair the structure, exterior
 * and installations) and s9A / Homes (Fitness for Human Habitation) Act 2018
 * (the home must be fit for habitation, incl. freedom from serious damp / mould).
 * The tenant must NOTIFY the landlord and allow a reasonable time to repair;
 * remedies are an order for the works (specific performance) plus damages.
 * Process: the Pre-Action Protocol for Housing Conditions Claims (England) — a
 * Letter of Claim, a 20-working-day landlord response window, then County Court.
 */

import type { Playbook, CaseAssessment, EscalationSignal } from "../../core/types.ts";
import type { HousingDisrepairCase, HousingDisrepairBranch } from "./case.ts";
import {
  housingDisrepairJsonSchema,
  housingDisrepairGeminiSchema,
  EXTRACTION_INSTRUCTIONS,
} from "./schema.ts";
import { normalizeHousingDisrepairCase } from "./normalize.ts";
import { classify, BRANCH_LABELS } from "./decisionTree.ts";
import { computeKeyDates } from "./keyDates.ts";
import { buildToolsForBranch } from "./toolsArsenal.ts";
import { formatUK, parseISO } from "../../core/dates.ts";
import { buildNextMove } from "../../core/negotiation.ts";

/**
 * The decision gate. Negotiation = gather information before deciding; the user
 * stays self-serve while a calibrated Letter of Claim can still move things, and
 * only escalates to a human lawyer once that information-gathering is exhausted
 * (the user reports back a later `negotiationStage`) or a personal-injury /
 * urgent-health element raises the stakes.
 */
function escalationFor(c: HousingDisrepairCase, branch: HousingDisrepairBranch): EscalationSignal {
  const stage = c.negotiationStage ?? "initial";

  switch (branch) {
    case "URGENT_HEALTH_RISK":
      return {
        level: "escalate",
        recommend: true,
        reason:
          "Serious damp / mould with a health risk to a vulnerable occupant — push the council's EHO and " +
          "urgent works now, and get legal advice: the personal-injury element and its 3-year limitation " +
          "make this more than a self-serve matter.",
        triggers: ["urgent_health_risk", "personal_injury_element"],
      };

    case "LANDLORD_ACTING":
      return {
        level: "self_serve",
        recommend: false,
        reason:
          "Works are in hand — handle it yourself: confirm the scope in writing, don't sign away your " +
          "claim, and monitor completion. Escalate only if the repair does not hold.",
        triggers: ["watch:recurrence", "watch:completion"],
      };

    case "REPORTED_NOT_REPAIRED":
    default:
      if (stage === "post_protocol")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "The 20-working-day protocol window has passed with no remedy — information-gathering is " +
            "exhausted; a lawyer can issue the County Court claim for the works and damages.",
          triggers: ["protocol_window_expired"],
        };
      if (stage === "post_letter_of_claim")
        return {
          level: "monitor",
          recommend: false,
          reason:
            "Letter of Claim sent — hold until the 20-working-day protocol response deadline. Escalate if " +
            "the landlord stays silent or refuses to do the works.",
          triggers: ["watch:protocol_response"],
        };
      return {
        level: "monitor",
        recommend: false,
        reason:
          "Send the Pre-Action Protocol Letter of Claim yourself to surface the landlord's position and " +
          "force disclosure of its records. Bring in a lawyer before issuing the County Court claim.",
        triggers: ["watch:before_court_filing"],
      };
  }
}

function assess(c: HousingDisrepairCase): CaseAssessment {
  const k = computeKeyDates(c);
  const { branch, reasoning } = classify(c);
  const tools = buildToolsForBranch(branch, c, k);

  const keyDates: Record<string, string> = {
    "First reported": formatUK(k.firstReportedDate),
    "Reasonable repair deadline": formatUK(k.reasonableRepairDeadline),
    "Letter of Claim — send by": formatUK(k.letterOfClaimSendBy),
    "Protocol response deadline (20 working days)": formatUK(k.protocolResponseDeadline),
    "Limitation — contract (6 yrs)": formatUK(k.contractLimitationLongstop),
  };
  if (c.health.healthImpactReported || c.health.gpLetterProvided)
    keyDates["Limitation — personal injury (3 yrs)"] = formatUK(k.personalInjuryLimitationLongstop);
  if (c.inspection.inspected && c.inspection.inspectionDate)
    keyDates["Inspection"] = formatUK(parseISO(c.inspection.inspectionDate));

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

export const housingDisrepairPlaybook: Playbook<HousingDisrepairCase> = {
  id: "housing_disrepair",
  label: "UK housing disrepair (damp & mould)",
  extraction: {
    instructions: EXTRACTION_INSTRUCTIONS,
    jsonSchema: housingDisrepairJsonSchema as unknown as Record<string, unknown>,
    geminiSchema: housingDisrepairGeminiSchema,
  },
  normalize: (raw, input, warnings) => normalizeHousingDisrepairCase(raw, input, warnings),
  assess,
};
