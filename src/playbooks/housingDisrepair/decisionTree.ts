/**
 * The housing-disrepair decision tree, as code.
 *
 *   Tenant has reported damp / mould to the landlord
 *     └─ Serious health risk?  (HHSRS Cat 1 / GP-evidenced harm / vulnerable
 *        occupant, AND still ongoing)
 *          ├─ Yes → URGENT_HEALTH_RISK   (push EHO + urgent works; get advice)
 *          └─ No  → Is the landlord actually fixing it?
 *                    ├─ Yes (works scheduled / done & not recurred) → LANDLORD_ACTING
 *                    └─ No  (reasonable time passed, still unrepaired
 *                            or recurred after token works) → REPORTED_NOT_REPAIRED
 *
 * Legal spine: Landlord and Tenant Act 1985 s11 + s9A (Homes (Fitness for Human
 * Habitation) Act 2018). The tenant must have NOTIFIED the landlord and allowed
 * a reasonable time to repair before the claim arises.
 */

import type { HousingDisrepairBranch, HousingDisrepairCase } from "./case.ts";
import { computeKeyDates } from "./keyDates.ts";
import { formatUK, isAfter, parseISO } from "../../core/dates.ts";

export interface Classification {
  branch: HousingDisrepairBranch;
  reasoning: string[];
}

export const BRANCH_LABELS: Record<HousingDisrepairBranch, string> = {
  URGENT_HEALTH_RISK: "Urgent health risk → escalate (EHO / urgent works) + get advice",
  REPORTED_NOT_REPAIRED: "Reported, not repaired → Letter of Claim, then County Court",
  LANDLORD_ACTING: "Landlord acting → monitor the works to completion",
};

/**
 * Node 1: "Serious health risk?". Fires when the home is still affected AND
 * there is hard evidence of serious harm — an HHSRS Category 1 hazard, a
 * GP/medical letter, or a vulnerable occupant (child / elderly / disabled)
 * exposed to the damp and mould.
 */
function isUrgentHealthRisk(c: HousingDisrepairCase): boolean {
  if (!c.disrepair.ongoing) return false;
  const seriousHazard = c.inspection.hhsrsCategory1 === true;
  const medicalEvidence = c.health.gpLetterProvided;
  const vulnerableExposed = c.health.vulnerableOccupant && c.health.healthImpactReported;
  return seriousHazard || medicalEvidence || vulnerableExposed;
}

/**
 * Node 2: "Is the landlord actually fixing it?". A landlord is "acting" only if
 * the defect is being addressed now — works are scheduled, or were completed and
 * have NOT recurred. Token works that recurred do not count.
 */
function isLandlordActing(c: HousingDisrepairCase): boolean {
  const { worksScheduled, worksCompleted, recurredAfterWorks } = c.landlordAction;
  if (recurredAfterWorks) return false;
  if (worksCompleted && !c.disrepair.ongoing) return true;
  if (worksScheduled) return true;
  return false;
}

export function classify(c: HousingDisrepairCase): Classification {
  const reasoning: string[] = [];
  const k = computeKeyDates(c);

  const rooms = c.disrepair.roomsAffected.length
    ? c.disrepair.roomsAffected.join(", ")
    : "the property";
  reasoning.push(
    `Tenant reported ${c.disrepair.description} (${rooms}) to the landlord on ` +
      `${formatUK(k.firstReportedDate)} by ${c.disrepair.reportMethod}.`,
  );

  const overdue = isAfter(k.evaluationDate, k.reasonableRepairDeadline);
  reasoning.push(
    overdue
      ? `A reasonable time to repair lapsed on ${formatUK(k.reasonableRepairDeadline)} — the duty to repair (s11 / s9A) is engaged.`
      : `The reasonable repair window runs to ${formatUK(k.reasonableRepairDeadline)}.`,
  );

  if (c.inspection.inspected) {
    const on = c.inspection.inspectionDate
      ? ` on ${formatUK(parseISO(c.inspection.inspectionDate))}`
      : "";
    reasoning.push(
      `Inspection${on}: ${c.inspection.findingsSummary ?? "findings recorded"}` +
        (c.inspection.hhsrsCategory1 ? " — HHSRS Category 1 hazard." : "."),
    );
  }

  // --- Node 1: serious health risk? ---
  if (isUrgentHealthRisk(c)) {
    const drivers: string[] = [];
    if (c.inspection.hhsrsCategory1) drivers.push("HHSRS Category 1 damp/mould hazard");
    if (c.health.gpLetterProvided) drivers.push("GP-evidenced health impact");
    if (c.health.vulnerableOccupant) drivers.push("vulnerable occupant exposed");
    reasoning.push(`Serious health risk (${drivers.join("; ")}).`);
    reasoning.push(
      "Branch: URGENT HEALTH RISK. Push the council's Environmental Health team and urgent works, " +
        "preserve the protocol route, and get legal advice given the personal-injury element.",
    );
    return { branch: "URGENT_HEALTH_RISK", reasoning };
  }

  // --- Node 2: is the landlord fixing it? ---
  if (isLandlordActing(c)) {
    reasoning.push(
      c.landlordAction.worksScheduled
        ? "Landlord has scheduled remedial works."
        : "Remedial works were completed and the defect has not recurred.",
    );
    reasoning.push("Branch: LANDLORD ACTING. Monitor the works through to verified completion.");
    return { branch: "LANDLORD_ACTING", reasoning };
  }

  if (c.landlordAction.recurredAfterWorks) {
    reasoning.push("Earlier works did not hold — the damp / mould recurred (token / ineffective repair).");
  } else if (!c.landlordAction.worksScheduled && !c.landlordAction.worksCompleted) {
    reasoning.push("No effective remedial works scheduled or completed despite the report.");
  }
  reasoning.push(
    "Branch: REPORTED, NOT REPAIRED. Send a Pre-Action Protocol Letter of Claim and, if the landlord " +
      "does not remedy within 20 working days, issue a County Court claim for the works plus damages.",
  );
  return { branch: "REPORTED_NOT_REPAIRED", reasoning };
}
