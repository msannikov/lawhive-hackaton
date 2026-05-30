/**
 * The decision tree from `deposit_return_decision_tree.svg`, as code.
 *
 *   Tenant requests deposit back
 *     └─ Protected within 30 days?  (+ prescribed information given)
 *          ├─ No  → NOT_PROTECTED_COURT   (s214: deposit + 1–3× penalty)
 *          └─ Yes → How is the landlord responding?
 *                    ├─ Agrees in full      → AGREES_IN_FULL
 *                    ├─ Disputes deductions → DISPUTES_DEDUCTIONS
 *                    └─ Landlord silent     → LANDLORD_SILENT
 */

import type { CaseBranch, TenantCase } from "./types.ts";
import { computeKeyDates } from "./keyDates.ts";
import { formatUK } from "./dates.ts";

export interface Classification {
  branch: CaseBranch;
  reasoning: string[];
}

export const BRANCH_LABELS: Record<CaseBranch, string> = {
  NOT_PROTECTED_COURT: "Not protected → court (s214 penalty)",
  AGREES_IN_FULL: "Landlord agrees in full → return within 10 days",
  DISPUTES_DEDUCTIONS: "Landlord disputes deductions → free scheme ADR",
  LANDLORD_SILENT: "Landlord silent → chase, then escalate",
};

/**
 * Node 1: "Protected within 30 days? + prescribed information given".
 * The "Yes" edge requires BOTH that the deposit was registered in an authorised
 * scheme within 30 days of receipt AND that the prescribed information was served.
 */
function isProtectedAndCompliant(c: TenantCase): boolean {
  const k = computeKeyDates(c);
  const p = c.protection;

  if (!p.protectedInScheme) return false;
  if (!p.prescribedInformationGiven) return false;

  // If we know the protection date, it must fall within the 30-day window.
  if (p.dateProtected) {
    const protectedOn = new Date(p.dateProtected);
    if (protectedOn.getTime() > k.protectionDeadline.getTime()) return false;
  }
  return true;
}

export function classify(c: TenantCase): Classification {
  const reasoning: string[] = [];
  const k = computeKeyDates(c);

  reasoning.push("Tenant requests deposit back.");
  reasoning.push(
    `Deposit of £${c.deposit.amount.toFixed(2)} received ${formatUK(
      k.depositPaidDate,
    )}; 30-day protection deadline was ${formatUK(k.protectionDeadline)}.`,
  );

  // --- Node 1: protected within 30 days + prescribed information given? ---
  const searches = c.protection.schemeSearches ?? [];
  const negativeSearches = searches.filter((s) => s.searched && !s.found);
  if (negativeSearches.length) {
    reasoning.push(
      `Scheme searches returned no record: ${negativeSearches
        .map((s) => s.scheme)
        .join(", ")}.`,
    );
  }

  if (!isProtectedAndCompliant(c)) {
    if (!c.protection.protectedInScheme) {
      reasoning.push("No deposit record found in any authorised scheme → not protected.");
    } else if (!c.protection.prescribedInformationGiven) {
      reasoning.push("Prescribed information was not served within 30 days → non-compliant.");
    } else {
      reasoning.push("Deposit was protected late (outside the 30-day window) → non-compliant.");
    }
    reasoning.push(
      "Branch: NOT PROTECTED → court. Tenant may claim the deposit plus a 1–3× statutory penalty (s214 Housing Act 2004).",
    );
    return { branch: "NOT_PROTECTED_COURT", reasoning };
  }

  reasoning.push("Deposit protected within 30 days and prescribed information served → compliant.");

  // --- Node 2: how is the landlord responding? ---
  switch (c.landlordResponse) {
    case "agrees_in_full":
      reasoning.push("Landlord agrees to return the deposit in full.");
      return { branch: "AGREES_IN_FULL", reasoning };
    case "disputes_deductions":
      reasoning.push("Landlord disputes deductions → use the scheme's free ADR.");
      return { branch: "DISPUTES_DEDUCTIONS", reasoning };
    case "silent":
    case "unknown":
    default:
      reasoning.push(
        c.landlordResponse === "unknown"
          ? "Landlord response unknown → treat as silent: chase, then escalate."
          : "Landlord is silent → chase, then escalate.",
      );
      return { branch: "LANDLORD_SILENT", reasoning };
  }
}
