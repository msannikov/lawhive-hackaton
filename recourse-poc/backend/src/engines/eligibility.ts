/**
 * Eligibility engine (spec §3.3) — pure function `case → EligibilityResult`.
 *
 * In-scope gate (hard boundary, §1): AST AND money deposit AND tenancy began on/
 * after 6 Apr 2007 AND country ∈ {England, Wales}.
 * Breach detection (R1, R2): a "no" on protection or prescribed information is a
 * confirmed breach. "unknown" is NOT treated as a breach here — the escalation
 * router handles unknowns rather than guessing against the landlord.
 * Reasons are R-codes for the provenance trail.
 */
import type { DepositCase, EligibilityResult } from "../models";

/** Tenancy-deposit protection began with the Housing Act 2004 on 6 April 2007. */
const SCHEME_START = "2007-04-06";

export function computeEligibility(c: DepositCase): EligibilityResult {
  const in_scope =
    c.tenancy_type === "AST" &&
    (c.country === "England" || c.country === "Wales") &&
    c.deposit_amount > 0 &&
    c.tenancy_start_date >= SCHEME_START; // ISO yyyy-mm-dd sorts lexicographically

  const breach_types: string[] = [];
  const reasons: string[] = [];

  if (c.protected_status === "no") {
    breach_types.push("s213(3)");
    reasons.push("R1");
  }
  if (c.prescribed_info_received === "no") {
    breach_types.push("s213(6)");
    reasons.push("R2");
  }

  const breach = breach_types.length > 0;
  // The right to apply to the county court (R4) only matters once in scope + breached.
  if (breach && in_scope) reasons.push("R4");

  return { in_scope, breach, breach_types, reasons };
}
