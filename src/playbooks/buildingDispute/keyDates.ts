/**
 * Derives every date the decision tree and tools need from the raw case facts.
 * Centralising this keeps deadline logic consistent across all branches.
 */

import type { BuildingDisputeCase } from "./case.ts";
import {
  parseISO,
  addCalendarDays,
  addYears,
} from "../../core/dates.ts";

export interface KeyDates {
  /** "Today" used for all relative deadlines. */
  evaluationDate: Date;
  /** Date the contractor abandoned the works / the breach crystallised. */
  breachDate: Date;
  /** Assemble the evidence + remedial quote (quantify the loss) by this date. */
  quantifyLossBy: Date;
  /** Send the Letter Before Claim by this date. */
  letterBeforeClaimSendBy: Date;
  /** Reasonable response window the LBC gives the contractor (14 days). */
  letterBeforeClaimResponseDeadline: Date;
  /** Issue a County Court claim by this date if still unresolved. */
  issueClaimBy: Date;
  /** 6-year limitation longstop for a breach-of-contract claim. */
  claimLimitationLongstop: Date;
}

export function computeKeyDates(c: BuildingDisputeCase): KeyDates {
  const evaluationDate = c.evaluationDate
    ? parseISO(c.evaluationDate)
    : parseISO(new Date().toISOString().slice(0, 10));

  // The breach (abandonment / defective work) is the limitation trigger. If it
  // isn't stated, fall back to the evaluation date as a safe lower bound.
  const breachDate = c.breachDate ? parseISO(c.breachDate) : evaluationDate;

  // Pull the evidence + remedial quote together first — the loss underpins the
  // demand and any claim.
  const quantifyLossBy = addCalendarDays(evaluationDate, 7);

  // Pre-Action Protocol for Construction & Engineering Disputes: send a Letter
  // Before Claim, then allow a reasonable time (14 days) to respond.
  const letterBeforeClaimSendBy = addCalendarDays(evaluationDate, 7);
  const letterBeforeClaimResponseDeadline = addCalendarDays(letterBeforeClaimSendBy, 14);

  // Issue the County Court claim only after the LBC window expires.
  const issueClaimBy = addCalendarDays(letterBeforeClaimResponseDeadline, 7);

  // Limitation Act 1980 s5: 6 years from the date of breach.
  const claimLimitationLongstop = addYears(breachDate, 6);

  return {
    evaluationDate,
    breachDate,
    quantifyLossBy,
    letterBeforeClaimSendBy,
    letterBeforeClaimResponseDeadline,
    issueClaimBy,
    claimLimitationLongstop,
  };
}

/** Total the customer paid the contractor. */
export function totalPaid(c: BuildingDisputeCase): number {
  return c.payments.reduce((sum, p) => sum + p.amount, 0);
}

/** Total remedial/completion cost evidenced (the headline loss). */
export function totalRemedialCost(c: BuildingDisputeCase): number {
  return c.remedialCosts.reduce((sum, r) => sum + r.amount, 0);
}

/**
 * The recoverable loss = reasonable cost of completing/remedying the work, less
 * any unpaid balance of the original contract (the customer must give credit for
 * money it never paid the original contractor). Never negative.
 */
export function recoverableLoss(c: BuildingDisputeCase): number {
  const remedial = totalRemedialCost(c);
  const unpaidBalance =
    c.contract.agreedPrice != null
      ? Math.max(0, c.contract.agreedPrice - totalPaid(c))
      : 0;
  return Math.max(0, remedial - unpaidBalance);
}
