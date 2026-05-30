/**
 * The building-dispute decision tree, as code.
 *
 *   Customer paid for building work that was abandoned / incomplete / defective
 *     └─ Is the contractor behaving abusively or making intimidating threats?
 *          ├─ Yes → CONTRACTOR_THREATENING  (document everything + firm LBC;
 *          │                                 consider reporting under PHA 1997)
 *          └─ No  → Is the contractor actively negotiating / engaging?
 *                    ├─ Yes → NEGOTIATING            (settle for the remedial cost)
 *                    └─ No  → INCOMPLETE_OR_DEFECTIVE (demand completion / recover
 *                                                      remedial costs → LBC → court)
 *
 * Legal essence: breach of contract; for a consumer, Consumer Rights Act 2015 s49
 * (reasonable care and skill) and s52 (reasonable time). Damages are normally the
 * reasonable cost of completing or remedying the work, subject to the duty to
 * mitigate.
 */

import type { BuildingDisputeBranch, BuildingDisputeCase } from "./case.ts";
import { recoverableLoss, totalPaid } from "./keyDates.ts";

export interface Classification {
  branch: BuildingDisputeBranch;
  reasoning: string[];
}

export const BRANCH_LABELS: Record<BuildingDisputeBranch, string> = {
  INCOMPLETE_OR_DEFECTIVE: "Work abandoned/incomplete/defective → demand completion or recover remedial cost",
  CONTRACTOR_THREATENING: "Contractor abusive/threatening → document + firm LBC, consider reporting",
  NEGOTIATING: "Contractor engaging → settle for the remedial cost",
};

const money = (n: number) => `£${n.toFixed(2)}`;

export function classify(c: BuildingDisputeCase): Classification {
  const reasoning: string[] = [];

  reasoning.push(
    `Customer paid ${money(totalPaid(c))} for "${c.contract.scopeOfWorks}" that was ` +
      `left incomplete or defective.`,
  );
  if (c.customerType === "consumer") {
    reasoning.push(
      "Customer is a consumer → Consumer Rights Act 2015 s49 (reasonable care and skill) " +
        "and s52 (reasonable time) apply alongside breach of contract.",
    );
  } else {
    reasoning.push("Customer engaged the contractor in business → plain breach of contract.");
  }
  reasoning.push(
    `Reasonable cost of completing/remedying the work (the loss) is ${money(recoverableLoss(c))}.`,
  );

  // --- Node 1: abusive / threatening conduct? ---
  if (c.threateningConduct || c.contractorResponse === "threatening") {
    reasoning.push(
      "Contractor has sent abusive or intimidating messages → document everything; this may " +
        "engage the Protection from Harassment Act 1997.",
    );
    reasoning.push(
      "Branch: CONTRACTOR THREATENING — preserve evidence, send a firm Letter Before Claim, and " +
        "consider reporting the harassment.",
    );
    return { branch: "CONTRACTOR_THREATENING", reasoning };
  }

  // --- Node 2: is the contractor engaging / negotiating? ---
  if (c.contractorResponse === "negotiating") {
    reasoning.push("Contractor is engaging → aim to settle for the remedial cost without court.");
    reasoning.push("Branch: NEGOTIATING — settle for the remedial cost.");
    return { branch: "NEGOTIATING", reasoning };
  }

  // --- Default: abandoned / incomplete / defective, no useful response ---
  reasoning.push(
    c.contractorResponse === "abandoned"
      ? "Contractor abandoned the works."
      : c.contractorResponse === "silent"
        ? "Contractor is not responding."
        : c.contractorResponse === "disputes_liability"
          ? "Contractor disputes liability."
          : "Contractor's position is unclear → treat as unresolved.",
  );
  reasoning.push(
    "Branch: INCOMPLETE OR DEFECTIVE — demand completion or recover the remedial cost via a " +
      "Letter Before Claim, then a County Court claim.",
  );
  return { branch: "INCOMPLETE_OR_DEFECTIVE", reasoning };
}
