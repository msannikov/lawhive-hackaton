/**
 * The CRA 2015 faulty-goods decision tree, as code.
 *
 *   Consumer bought goods from a trader; goods are faulty (not of satisfactory
 *   quality / not fit for purpose / not as described — ss9–11).
 *     └─ Did the fault arise within 30 days of ownership?  (s22)
 *          ├─ Yes → WITHIN_30_DAYS        (short-term right to reject — full refund)
 *          └─ No  → Has the trader already had ONE repair attempt that failed? (s23/s24)
 *                    ├─ Yes → FINAL_RIGHT_TO_REJECT  (reject / price reduction, s24)
 *                    └─ No  → How is the trader responding?
 *                              ├─ refuses / silent → DEALER_REFUSES (LBC → ADR / court)
 *                              └─ otherwise        → REPAIR_OR_REPLACE (require repair/replace, s23)
 *
 * Within the first 6 months the fault is presumed to have been present at
 * purchase (reversed burden of proof, CRA s19(14)).
 */

import type { FaultyGoodsBranch, FaultyGoodsCase } from "./case.ts";
import { computeKeyDates } from "./keyDates.ts";
import { formatUK, addMonths, isAfter } from "../../core/dates.ts";

export interface Classification {
  branch: FaultyGoodsBranch;
  reasoning: string[];
}

export const BRANCH_LABELS: Record<FaultyGoodsBranch, string> = {
  WITHIN_30_DAYS: "Within 30 days → short-term right to reject (full refund)",
  REPAIR_OR_REPLACE: "After 30 days → require repair or replacement",
  FINAL_RIGHT_TO_REJECT: "Repair failed → price reduction or final right to reject",
  DEALER_REFUSES: "Trader refuses / silent → Letter Before Claim, then ADR / court",
};

export function classify(c: FaultyGoodsCase): Classification {
  const reasoning: string[] = [];
  const k = computeKeyDates(c);

  reasoning.push(
    `Consumer bought "${c.goods.description}" from ${c.seller.name} for £${c.purchase.amount.toFixed(
      2,
    )} on ${formatUK(k.purchaseDate)}.`,
  );

  // Threshold: CRA rights run against a TRADER, not a private seller.
  if (c.sellerType === "private") {
    reasoning.push(
      "Seller appears to be a PRIVATE seller — CRA 2015 satisfactory-quality rights do not apply; only 'as described' / misrepresentation may help. Treating as a dispute requiring escalation.",
    );
    reasoning.push("Branch: TRADER REFUSES path — seek advice before acting.");
    return { branch: "DEALER_REFUSES", reasoning };
  }
  if (c.sellerType === "unknown") {
    reasoning.push(
      "Seller type unconfirmed — CRA 2015 rights assume a trader/dealer. Confirm the seller is a business.",
    );
  }

  reasoning.push(
    `Fault: ${c.fault.description}` +
      (c.fault.diagnosticFinding ? ` (diagnosis: ${c.fault.diagnosticFinding})` : "") +
      ". Goods not of satisfactory quality / fit for purpose (CRA 2015 ss9–10).",
  );

  // Reversed burden of proof in the first 6 months (s19(14)).
  const within6Months = !isAfter(k.evaluationDate, addMonths(k.purchaseDate, 6));
  if (within6Months) {
    reasoning.push(
      "Within 6 months of purchase: the fault is presumed to have been present at the point of sale (reversed burden of proof, CRA s19(14)).",
    );
  }

  // --- Node 1: fault within the 30-day short-term right to reject? ---
  reasoning.push(
    `30-day short-term right to reject runs to ${formatUK(k.rejectWindowEnd)} (CRA s22).` +
      (k.faultAppearedDate ? ` Fault appeared ${formatUK(k.faultAppearedDate)}.` : ""),
  );
  if (k.withinRejectWindow) {
    reasoning.push(
      "Fault arose within 30 days of ownership → short-term right to reject for a FULL refund (CRA s20/s22).",
    );
    return { branch: "WITHIN_30_DAYS", reasoning };
  }
  reasoning.push("Fault arose after the 30-day window → short-term right to reject is no longer available.");

  // --- Node 2: has a single repair already failed? ---
  if (c.repairAttempted || c.dealerResponse === "repair_failed") {
    reasoning.push(
      "A repair (or replacement) has already been attempted and the fault persists → final right to reject or a price reduction (CRA s24).",
    );
    return { branch: "FINAL_RIGHT_TO_REJECT", reasoning };
  }

  // --- Node 3: how is the trader responding? ---
  switch (c.dealerResponse) {
    case "refuses":
      reasoning.push("Trader refuses to repair, replace or refund → escalate via Letter Before Claim.");
      return { branch: "DEALER_REFUSES", reasoning };
    case "silent":
    case "unknown":
      reasoning.push(
        c.dealerResponse === "unknown"
          ? "Trader response unknown → treat as unresponsive; demand a remedy, then escalate."
          : "Trader is silent → demand a remedy in writing, then escalate.",
      );
      // Silence after a first complaint is functionally a refusal to engage.
      return { branch: "DEALER_REFUSES", reasoning };
    case "agrees_refund":
      reasoning.push(
        "Trader agrees to refund — pursue the agreed refund; this is the repair/replace path with a cooperative trader.",
      );
      return { branch: "REPAIR_OR_REPLACE", reasoning };
    case "offers_repair":
    default:
      reasoning.push(
        "First occurrence, trader engaging → require a repair or replacement within a reasonable time and at no cost (CRA s23).",
      );
      return { branch: "REPAIR_OR_REPLACE", reasoning };
  }
}
