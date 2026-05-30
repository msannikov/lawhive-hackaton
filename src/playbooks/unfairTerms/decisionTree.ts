/**
 * The unfair-terms decision tree, as code.
 *
 *   Consumer challenges a gym term (lock-in / auto-renewal / cancellation charge)
 *   and a debt collector is now chasing the resulting "debt".
 *     └─ Is the collection conduct aggressive / misleading (FCA CONC)?
 *          ├─ Yes → AGGRESSIVE_COLLECTION   (dispute + complain under CONC)
 *          └─ No  → Does the term look unfair / not transparent (CRA 2015 Pt 2)?
 *                    ├─ Yes → UNFAIR_TERM_LIKELY  (term non-binding; dispute the debt)
 *                    └─ No  → ARGUABLE            (negotiate a reduced settlement)
 *
 * A term is unfair if it causes a significant imbalance contrary to good faith
 * (CRA s62). The Schedule 2 "grey list" flags disproportionate cancellation
 * charges, hard-to-exit auto-renewals and long minimum terms. A core price /
 * subject term escapes the test only if it is transparent AND prominent
 * (s64/s68). CMA guidance: it is unfair to lock gym members in when their
 * circumstances change (job loss, relocation, injury).
 */

import type { UnfairTermsCase, UnfairTermsBranch } from "./case.ts";
import { computeKeyDates } from "./keyDates.ts";
import { formatUK } from "../../core/dates.ts";

export interface Classification {
  branch: UnfairTermsBranch;
  reasoning: string[];
}

export const BRANCH_LABELS: Record<UnfairTermsBranch, string> = {
  UNFAIR_TERM_LIKELY: "Term likely unfair → non-binding; dispute the debt",
  AGGRESSIVE_COLLECTION: "Aggressive collection → dispute + complain (CONC)",
  ARGUABLE: "Term may be enforceable → negotiate a reduced settlement",
};

/** A grey-list term type is presumptively suspect under CRA Schedule 2. */
function isGreyListType(c: UnfairTermsCase): boolean {
  return (
    c.challengedTerm.type === "minimum_term" ||
    c.challengedTerm.type === "auto_renewal" ||
    c.challengedTerm.type === "cancellation_charge"
  );
}

/** CMA gym guidance: a change of circumstances is a strong reason to exit. */
function hasGoodCancellationReason(c: UnfairTermsCase): boolean {
  return (
    c.cancellationReason === "job_loss" ||
    c.cancellationReason === "relocation" ||
    c.cancellationReason === "injury_or_illness" ||
    c.cancellationReason === "financial_hardship"
  );
}

/**
 * Node 2: does the challenged term look unfair under CRA 2015 Part 2?
 * Unfair if it is a grey-list term AND either it was not transparent/prominent
 * (so it does not even escape the fairness test) OR the consumer has a genuine
 * change-of-circumstances reason to exit (CMA guidance on gym contracts).
 */
function looksUnfair(c: UnfairTermsCase): boolean {
  if (!isGreyListType(c)) return false;
  const notTransparent = !c.challengedTerm.transparent || !c.challengedTerm.prominent;
  return notTransparent || hasGoodCancellationReason(c);
}

export function classify(c: UnfairTermsCase): Classification {
  const reasoning: string[] = [];
  const k = computeKeyDates(c);

  reasoning.push(
    `Consumer challenges the ${c.challengedTerm.type.replace(/_/g, " ")} term in the ` +
      `${c.business.name} membership (started ${formatUK(k.membershipStartDate)}, ` +
      `${c.membership.minimumTermMonths}-month minimum at £${c.membership.monthlyFee.toFixed(2)}/mo).`,
  );
  reasoning.push(
    `${c.debt.collectorName} is chasing £${c.debt.amount.toFixed(2)}.`,
  );

  // --- Node 1: aggressive / misleading collection conduct? (FCA CONC) ---
  if (c.debt.aggressive) {
    reasoning.push(
      "Debt-collection conduct appears aggressive or misleading (threats / pressure / " +
        "misstating the consumer's position) → breaches FCA CONC; the debt is disputed and " +
        "should be paused while investigated.",
    );
    reasoning.push(
      "Branch: AGGRESSIVE COLLECTION → dispute the debt in writing and complain under CONC.",
    );
    return { branch: "AGGRESSIVE_COLLECTION", reasoning };
  }

  // --- Node 2: does the term look unfair / not transparent? (CRA 2015 Pt 2) ---
  if (looksUnfair(c)) {
    if (!c.challengedTerm.transparent || !c.challengedTerm.prominent) {
      reasoning.push(
        "The challenged term was not transparent and prominent (CRA s64/s68), so it does not " +
          "escape the fairness test.",
      );
    }
    if (hasGoodCancellationReason(c)) {
      reasoning.push(
        `Consumer's reason to cancel (${c.cancellationReason.replace(/_/g, " ")}) is a genuine ` +
          "change of circumstances — CMA guidance says locking a member in here is unfair.",
      );
    }
    reasoning.push(
      "A grey-list term (disproportionate charge / hard-to-exit renewal / long lock-in) that " +
        "causes a significant imbalance is not binding on the consumer (CRA s62).",
    );
    reasoning.push(
      "Branch: UNFAIR TERM LIKELY → assert the term is non-binding and dispute the debt in writing.",
    );
    return { branch: "UNFAIR_TERM_LIKELY", reasoning };
  }

  // --- Otherwise: the term may be enforceable ---
  reasoning.push(
    "The term is transparent/prominent and there is no clear change-of-circumstances ground, so " +
      "it may be enforceable.",
  );
  reasoning.push(
    "Branch: ARGUABLE → negotiate a reduced settlement rather than litigate.",
  );
  return { branch: "ARGUABLE", reasoning };
}
