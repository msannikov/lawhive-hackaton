/**
 * The procedural-posture decision tree, as code. This is a mid-litigation
 * RECOVERY playbook, so the tree turns on what has gone wrong procedurally, not
 * on the merits of the nuisance claim.
 *
 *   Case is in proceedings (small-claims track, CPR)
 *     └─ Has a judgment/order been MADE against the party?
 *          ├─ Yes → JUDGMENT_ENTERED        (set-aside CPR 13.3/39.3 and/or appeal in 21 days)
 *          └─ No → Has a directions deadline been MISSED?
 *                   ├─ Yes → MISSED_DIRECTIONS_DEADLINE  (relief from sanctions, CPR 3.9 / Denton)
 *                   └─ No  → ON_TRACK        (comply with the next directions deadline)
 */

import type { SmallClaimsNuisanceCase, SmallClaimsNuisanceBranch } from "./case.ts";
import { computeKeyDates } from "./keyDates.ts";
import { formatUK } from "../../core/dates.ts";

export interface Classification {
  branch: SmallClaimsNuisanceBranch;
  reasoning: string[];
}

export const BRANCH_LABELS: Record<SmallClaimsNuisanceBranch, string> = {
  JUDGMENT_ENTERED: "Judgment entered → set-aside and/or appeal (21 days)",
  MISSED_DIRECTIONS_DEADLINE: "Directions deadline missed → relief from sanctions (CPR 3.9)",
  ON_TRACK: "On track → comply with the next directions deadline",
};

export function classify(c: SmallClaimsNuisanceCase): Classification {
  const reasoning: string[] = [];
  const k = computeKeyDates(c);

  reasoning.push(
    `Case ${c.caseNumber} (${c.claimant.name} v ${c.defendant.name}) is in proceedings on the ` +
      `small-claims track in ${c.court}.`,
  );
  reasoning.push(
    `Private nuisance: ${c.nuisance.description}; remedial cost claimed £${c.nuisance.remedialCost.toFixed(
      2,
    )}.`,
  );

  // --- Node 1: has a judgment/order been made against the party? ---
  if (c.judgment) {
    reasoning.push(
      `A judgment/order was made on ${formatUK(k.judgmentDate!)}` +
        (c.judgment.outcome ? ` (${c.judgment.outcome})` : "") +
        ` — basis: ${c.judgment.basis}.`,
    );
    if (c.judgment.permissionToAppealRefused) {
      reasoning.push("Permission to appeal was refused below — it must now be sought from the appeal court.");
    }
    if (k.appealLongstop) {
      reasoning.push(
        `Branch: JUDGMENT ENTERED. The appellant's notice (N164) must be filed within 21 days, i.e. by ` +
          `${formatUK(k.appealLongstop)} (CPR 52.12); consider set-aside in parallel ` +
          `(CPR 13.3 for default judgment, CPR 39.3 if a party failed to attend).`,
      );
    }
    return { branch: "JUDGMENT_ENTERED", reasoning };
  }

  // --- Node 2: has a directions deadline been missed? ---
  if (c.missedDeadline) {
    reasoning.push(
      `The "${c.missedDeadline.step}" directions deadline of ${formatUK(k.missedDeadlineDate!)} was missed` +
        (c.missedDeadline.documentFiled ? " (document since filed)" : " (document still outstanding)") +
        ".",
    );
    reasoning.push(
      "Branch: MISSED DIRECTIONS DEADLINE. A sanction may apply (e.g. CPR 32.10 bars late witness " +
        "evidence), so apply PROMPTLY for relief from sanctions on Form N244 under CPR 3.9, applying the " +
        "Denton v TH White three-stage test (seriousness; reason; all the circumstances).",
    );
    return { branch: "MISSED_DIRECTIONS_DEADLINE", reasoning };
  }

  // --- Node 3: no breach → on track ---
  if (k.nextDirectionsStep) {
    reasoning.push(
      `No breach recorded. Next directions step: "${k.nextDirectionsStep.step}" by ` +
        `${formatUK(k.nextDirectionsStep.date)}.`,
    );
  } else {
    reasoning.push("No breach recorded and no further directions deadline identified.");
  }
  reasoning.push("Branch: ON TRACK. Comply with the directions order and keep the timetable.");
  return { branch: "ON_TRACK", reasoning };
}
