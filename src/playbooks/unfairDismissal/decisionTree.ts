/**
 * The unfair-dismissal / discrimination decision tree, as code.
 *
 *   Dismissed employee (redundancy used as the stated reason)
 *     ├─ Discrimination alleged (Equality Act 2010)?  ── NO qualifying period
 *     │     YES → DISCRIMINATION_CLAIM   (strongest where redundancy looks like
 *     │            a pretext / a protected act was done → victimisation)
 *     └─ NO discrimination →
 *           ├─ 2+ years' continuous service?
 *           │     YES → UNFAIR_DISMISSAL   (ordinary unfair dismissal, ERA 1996)
 *           │     NO  → (no ordinary unfair-dismissal right) → SETTLEMENT_DECISION
 *           │            if an offer is live, else REVIEW_NEEDED
 *           └─ ...
 *
 *   Orthogonal to the merits: if a settlement OFFER is on the table, the live
 *   question for THIS round is the offer (SETTLEMENT_DECISION) — but only once
 *   the strongest claim has been identified so the offer can be valued against
 *   it. We surface the offer through tools/escalation rather than hiding the
 *   underlying claim, so the branch reports the strongest CLAIM and the
 *   settlement is handled as the recommended next move when an offer is live.
 *
 *   REVIEW_NEEDED is reserved for genuinely incomplete facts (no EDT, so the
 *   tribunal deadline cannot be computed).
 */

import type { UnfairDismissalCase, UnfairDismissalBranch } from "./case.ts";
import { computeKeyDates } from "./keyDates.ts";
import { formatUK } from "../../core/dates.ts";

export interface Classification {
  branch: UnfairDismissalBranch;
  reasoning: string[];
}

export const BRANCH_LABELS: Record<UnfairDismissalBranch, string> = {
  DISCRIMINATION_CLAIM: "Discrimination (Equality Act 2010) — no qualifying period, uncapped + injury to feelings",
  UNFAIR_DISMISSAL: "Unfair dismissal (2+ years' service) — Employment Rights Act 1996",
  SETTLEMENT_DECISION: "Settlement offer on the table — evaluate vs likely award before the ET1 limit",
  REVIEW_NEEDED: "Facts incomplete — review needed",
};

export function classify(c: UnfairDismissalCase): Classification {
  const reasoning: string[] = [];
  const k = computeKeyDates(c);

  reasoning.push(
    `Employee dismissed by ${c.employer.name}; reason given: ${c.dismissal.reason}` +
      (c.dismissal.reason === "redundancy" ? " (redundancy)." : "."),
  );

  if (!k.endDate) {
    reasoning.push(
      "No effective date of termination found in the documents → the 3-month ET1 " +
        "limit cannot be computed. Facts incomplete.",
    );
    return { branch: "REVIEW_NEEDED", reasoning };
  }

  reasoning.push(
    `Continuous service ${formatUK(k.startDate)} → ${formatUK(k.endDate)} ` +
      `(~${k.serviceYears} year(s)); 2-year unfair-dismissal threshold ` +
      `${k.hasTwoYearsService ? "IS" : "is NOT"} met.`,
  );

  // ACAS gate — note (do not block): EC is mandatory before an ET1 claim.
  if (c.acas.completed && k.acasDayA && k.acasDayB) {
    reasoning.push(
      `ACAS Early Conciliation complete (Day A ${formatUK(k.acasDayA)} → Day B ` +
        `${formatUK(k.acasDayB)}); the EC certificate clears the way for an ET1.`,
    );
  } else {
    reasoning.push(
      "ACAS Early Conciliation is mandatory before an ET1 claim — no completed EC " +
        "certificate is evidenced, so EC must be started/finished first.",
    );
  }

  // --- Node 1: discrimination alleged? (Equality Act — no qualifying period) ---
  if (c.discrimination.alleged) {
    const ground = c.discrimination.ground ?? "a protected characteristic";
    reasoning.push(
      `Discrimination alleged on the ground of ${ground} (Equality Act 2010) — ` +
        "this needs NO qualifying period and can yield uncapped compensation plus " +
        "injury to feelings (Vento bands).",
    );
    if (c.dismissal.reason === "redundancy") {
      reasoning.push(
        "Where the redundancy looks like a pretext, the discrimination route is " +
          "typically the stronger claim.",
      );
    }
    if (c.discrimination.protectedActDone) {
      reasoning.push(
        "A protected act was done (e.g. a grievance alleging discrimination) and the " +
          "dismissal is said to be connected to it → also victimisation (s27 Equality Act 2010).",
      );
    }
    return { branch: "DISCRIMINATION_CLAIM", reasoning };
  }

  // --- Node 2: ordinary unfair dismissal needs 2 years' service ---
  if (k.hasTwoYearsService) {
    reasoning.push(
      "No discrimination alleged, but 2+ years' continuous service → an ordinary " +
        "unfair-dismissal claim is available (s94/s98 Employment Rights Act 1996), " +
        "including whether the redundancy was genuine and fairly conducted.",
    );
    return { branch: "UNFAIR_DISMISSAL", reasoning };
  }

  // --- Node 3: under 2 years, no discrimination ---
  if (c.settlement.offered) {
    reasoning.push(
      "Under 2 years' service and no discrimination alleged → limited ordinary " +
        "unfair-dismissal rights; with a settlement offer on the table, the live " +
        "question is whether to accept it.",
    );
    return { branch: "SETTLEMENT_DECISION", reasoning };
  }

  reasoning.push(
    "Under 2 years' service, no discrimination alleged and no settlement offer → " +
      "limited tribunal rights; review for notice/pay or automatic-unfair grounds.",
  );
  return { branch: "REVIEW_NEEDED", reasoning };
}
