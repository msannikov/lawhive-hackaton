/**
 * Unpaid-wages decision tree, as code.
 *
 *   Employer has not paid wages that are due
 *     └─ How is the employer responding?
 *          ├─ Engaging / agreeing to pay → EMPLOYER_ENGAGING
 *          ├─ Disputes the entitlement   → DISPUTED_COMMISSION  (typically the
 *          │                                commission: gather contract/scheme
 *          │                                evidence, then ACAS EC → ET)
 *          └─ Silent / clear sum withheld → UNLAWFUL_DEDUCTION  (s13 ERA: an
 *                                           unauthorised deduction → grievance →
 *                                           ACAS EC → ET)
 *
 * Legal essence: Employment Rights Act 1996 s13 — an employer must not make an
 * unauthorised DEDUCTION from wages; "wages" (s27) includes contractual
 * commission/bonus that has become payable. Failing to pay a sum that is
 * properly payable IS a deduction.
 */

import type { UnpaidWagesBranch, UnpaidWagesCase } from "./case.ts";
import { computeKeyDates } from "./keyDates.ts";
import { formatUK } from "../../core/dates.ts";

export interface Classification {
  branch: UnpaidWagesBranch;
  reasoning: string[];
}

export const BRANCH_LABELS: Record<UnpaidWagesBranch, string> = {
  UNLAWFUL_DEDUCTION: "Unlawful deduction (s13 ERA) → grievance, ACAS EC, ET",
  DISPUTED_COMMISSION: "Employer disputes commission → assemble evidence, ACAS EC, ET",
  EMPLOYER_ENGAGING: "Employer engaging → negotiate / settle",
};

const money = (n: number) => `£${n.toFixed(2)}`;

export function classify(c: UnpaidWagesCase): Classification {
  const reasoning: string[] = [];
  const k = computeKeyDates(c);

  reasoning.push(
    `${money(c.amountUnpaid)} in wages was due on ${formatUK(k.deductionDate)} but not paid.`,
  );
  const wageItems = c.unpaidItems.filter((it) => it.kind !== "other");
  if (wageItems.length) {
    reasoning.push(
      `Unpaid sums treated as "wages" under s27 ERA: ${wageItems
        .map((it) => `${it.label} (${money(it.amount)})`)
        .join(", ")}.`,
    );
  }
  if (c.commission.claimed && c.commission.confirmedInWriting) {
    reasoning.push(
      `Commission of ${money(c.commission.amount ?? 0)} was confirmed in writing` +
        (c.commission.confirmedBy ? ` by ${c.commission.confirmedBy}` : "") +
        " → it has become payable and counts as wages, despite any discretion clause.",
    );
  }

  // --- Node: how is the employer responding? ---
  switch (c.employerResponse) {
    case "pays_in_full":
    case "engaging":
      reasoning.push(
        c.employerResponse === "pays_in_full"
          ? "Employer has agreed to pay in full → confirm details and hold them to it."
          : "Employer is engaging on the figure/timeline → negotiate to settle before any claim.",
      );
      return { branch: "EMPLOYER_ENGAGING", reasoning };

    case "disputes":
      reasoning.push(
        "Employer disputes the entitlement (typically the commission) → assemble the contract " +
          "and commission-scheme evidence, then ACAS Early Conciliation and an Employment Tribunal claim.",
      );
      return { branch: "DISPUTED_COMMISSION", reasoning };

    case "silent":
    case "unknown":
    default:
      reasoning.push(
        c.employerResponse === "unknown"
          ? "Employer response unknown → treat as a clear withheld sum: unauthorised deduction."
          : "Employer is silent / has not paid a clearly-due sum → unauthorised deduction.",
      );
      reasoning.push(
        "Branch: UNLAWFUL DEDUCTION (s13 ERA 1996). Raise a grievance, start mandatory ACAS " +
          "Early Conciliation, then lodge an Employment Tribunal claim for the unpaid wages.",
      );
      return { branch: "UNLAWFUL_DEDUCTION", reasoning };
  }
}
