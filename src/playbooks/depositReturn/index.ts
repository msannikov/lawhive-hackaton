/**
 * Deposit-return playbook: the first concrete domain.
 *
 * Bundles the deposit-specific extraction schema, validator, decision tree and
 * tools arsenal behind the generic {@link Playbook} interface. The `assess`
 * function is the old `matchToolset` — the deterministic rules engine.
 */

import type { Playbook, CaseAssessment } from "../../core/types.ts";
import type { TenantCase } from "./case.ts";
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

  const summary =
    `Matched branch "${BRANCH_LABELS[branch]}" with ${tools.length} tool(s). ` +
    `Next action: ${tools[0]?.nextAction ?? "none"}`;

  return { branch, branchLabel: BRANCH_LABELS[branch], summary, reasoning, keyDates, tools };
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
