/**
 * Deterministic rules engine — the decision tree + deadline maths.
 *
 * This is intentionally pure: structured {@link TenantCase} facts in, a
 * {@link CaseAssessment} out, no I/O and no AI. It is the AUDITABLE core that
 * applies the law identically every time.
 *
 * It is NOT the public entry point. Real input is unstructured documents; the
 * async `evaluateCase` (src/evaluateCase.ts) first uses a VLM to extract a
 * TenantCase from those documents, then calls this function.
 */

import type { CaseAssessment, TenantCase } from "./types.ts";
import { classify, BRANCH_LABELS } from "./decisionTree.ts";
import { computeKeyDates } from "./keyDates.ts";
import { buildToolsForBranch } from "./toolsArsenal.ts";
import { formatUK } from "./dates.ts";

export function matchToolset(c: TenantCase): CaseAssessment {
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

  return {
    branch,
    branchLabel: BRANCH_LABELS[branch],
    summary,
    reasoning,
    keyDates,
    tools,
  };
}
