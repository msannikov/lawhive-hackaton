/**
 * Deposit-return playbook: the first concrete domain.
 *
 * Bundles the deposit-specific extraction schema, validator, decision tree and
 * tools arsenal behind the generic {@link Playbook} interface. The `assess`
 * function is the old `matchToolset` — the deterministic rules engine.
 */

import type { Playbook, CaseAssessment, EscalationSignal } from "../../core/types.ts";
import type { TenantCase, CaseBranch } from "./case.ts";
import {
  tenantCaseJsonSchema,
  tenantCaseGeminiSchema,
  EXTRACTION_INSTRUCTIONS,
} from "./schema.ts";
import { normalizeTenantCase } from "./normalize.ts";
import { classify, BRANCH_LABELS } from "./decisionTree.ts";
import { computeKeyDates } from "./keyDates.ts";
import { buildToolsForBranch } from "./toolsArsenal.ts";
import { formatUK } from "../../core/dates.ts";
import { buildNextMove } from "../../core/negotiation.ts";

/**
 * The decision gate. Negotiation = gather information before deciding; the user
 * stays self-serve while a calibrated letter can still move things, and only
 * escalates to a human lawyer once that information-gathering is exhausted
 * (the user reports back a later `negotiationStage`).
 */
function escalationFor(c: TenantCase, branch: CaseBranch): EscalationSignal {
  const stage = c.negotiationStage ?? "initial";

  switch (branch) {
    case "AGREES_IN_FULL":
      return {
        level: "self_serve",
        recommend: false,
        reason:
          "Landlord has agreed to return the deposit in full — handle it yourself; just confirm details and watch the return deadline.",
        triggers: [],
      };

    case "DISPUTES_DEDUCTIONS":
      if (stage === "post_adr")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "Scheme ADR did not resolve the dispute — a lawyer can advise on a County Court claim.",
          triggers: ["adr_exhausted"],
        };
      return {
        level: "monitor",
        recommend: false,
        reason:
          "Use the scheme's free ADR first. Escalate only if it fails or the deductions are high-value or legally complex.",
        triggers: ["watch:adr_outcome"],
      };

    case "LANDLORD_SILENT":
      if (stage !== "initial")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "Landlord stayed silent after your letter — information-gathering is exhausted; escalate to ADR/court or a lawyer.",
          triggers: ["no_response_after_letter"],
        };
      return {
        level: "monitor",
        recommend: false,
        reason: "Chase in writing first. If still silent after the deadline, escalate.",
        triggers: ["watch:no_response"],
      };

    case "NOT_PROTECTED_COURT":
    default:
      if (stage !== "initial")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "Deposit unprotected and no voluntary return after your letter — get a lawyer to issue the s214 claim (the 1–3× penalty is discretionary).",
          triggers: ["no_return_after_letter", "discretionary_penalty"],
        };
      return {
        level: "monitor",
        recommend: false,
        reason:
          "Send the calibrated Letter Before Action yourself to surface the landlord's position. Bring in a lawyer before issuing the s214 claim — the penalty multiplier is discretionary.",
        triggers: ["watch:before_court_filing"],
      };
  }
}

function assess(c: TenantCase): CaseAssessment {
  const k = computeKeyDates(c);
  const { branch, reasoning } = classify(c);
  const tools = buildToolsForBranch(branch, c, k);

  const keyDates: Record<string, string> = {
    "Deposit paid": formatUK(k.depositPaidDate),
    "30-day protection deadline": formatUK(k.protectionDeadline),
  };
  if (k.tenancyEndDate) keyDates["Tenancy end"] = formatUK(k.tenancyEndDate);
  if (k.contractualReturnDeadline)
    keyDates["Contractual return deadline"] = formatUK(k.contractualReturnDeadline);
  if (branch === "NOT_PROTECTED_COURT")
    keyDates["s214 claim longstop (6 yrs)"] = formatUK(k.claimLimitationLongstop);

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

export const depositReturnPlaybook: Playbook<TenantCase> = {
  id: "deposit_return",
  label: "UK tenancy deposit return",
  extraction: {
    instructions: EXTRACTION_INSTRUCTIONS,
    jsonSchema: tenantCaseJsonSchema as unknown as Record<string, unknown>,
    geminiSchema: tenantCaseGeminiSchema,
  },
  normalize: (raw, input, warnings) => normalizeTenantCase(raw, input, warnings),
  assess,
};
