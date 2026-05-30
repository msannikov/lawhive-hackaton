/**
 * Derives every date the decision tree and tools need from the raw case facts.
 * Centralising this keeps deadline logic consistent across all branches.
 *
 * THE key date is the Employment Tribunal limit for an unlawful-deductions
 * claim: 3 months LESS 1 day from the deduction (or the last in a series of
 * deductions). ACAS Early Conciliation must be started before that limit and
 * pauses the clock while it runs.
 */

import type { UnpaidWagesCase } from "./case.ts";
import {
  parseISO,
  addCalendarDays,
  addMonths,
} from "../../core/dates.ts";

export interface KeyDates {
  /** "Today" used for all relative deadlines. */
  evaluationDate: Date;
  /** The deduction date — pay date the wages were due but unpaid (last in series). */
  deductionDate: Date;
  /**
   * The Employment Tribunal limit: deduction + 3 months − 1 day (s23 ERA 1996 /
   * s207B mechanics). The hard backstop for the whole case.
   */
  etClaimLimit: Date;
  /**
   * Start ACAS Early Conciliation by this date — well before the ET limit so
   * the clock-pause and the post-EC extension still leave room to lodge the ET1.
   * Set two weeks before the limit as a safe self-serve trigger.
   */
  acasStartBy: Date;
  /** Raise a written grievance promptly (ACAS Code) — soft deadline. */
  grievanceRaiseBy: Date;
  /** Send a written demand / chase by this date. */
  demandSendBy: Date;
  /** Reasonable response window a written demand gives the employer. */
  demandResponseDeadline: Date;
}

export function computeKeyDates(c: UnpaidWagesCase): KeyDates {
  const evaluationDate = c.evaluationDate
    ? parseISO(c.evaluationDate)
    : parseISO(new Date().toISOString().slice(0, 10));

  const deductionDate = parseISO(c.deductionDate);

  // THE key date: 3 months less 1 day from the (last) deduction.
  const etClaimLimit = addCalendarDays(addMonths(deductionDate, 3), -1);

  // Start ACAS EC at least two weeks before the limit to be safe.
  const acasStartBy = addCalendarDays(etClaimLimit, -14);

  // Promptness deadlines anchored on the evaluation date.
  const grievanceRaiseBy = addCalendarDays(evaluationDate, 7);
  const demandSendBy = addCalendarDays(evaluationDate, 7);
  const demandResponseDeadline = addCalendarDays(demandSendBy, 7);

  return {
    evaluationDate,
    deductionDate,
    etClaimLimit,
    acasStartBy,
    grievanceRaiseBy,
    demandSendBy,
    demandResponseDeadline,
  };
}
