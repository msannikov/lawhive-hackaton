/**
 * Derives every date the decision tree and tools need from the raw case facts.
 * Centralising this keeps deadline logic consistent across all branches.
 */

import type { UnfairTermsCase } from "./case.ts";
import {
  parseISO,
  addCalendarDays,
  addMonths,
  addYears,
} from "../../core/dates.ts";

export interface KeyDates {
  /** "Today" used for all relative deadlines. */
  evaluationDate: Date;
  /** When the membership started. */
  membershipStartDate: Date;
  /** End of the minimum / lock-in term (start + minimumTermMonths). */
  minimumTermEndDate: Date;
  /** When the consumer first tried to cancel, if known. */
  cancellationAttemptDate?: Date;
  /** Date of the most recent collection letter, if known. */
  debtLetterDate?: Date;
  /**
   * Send a written dispute to the debt collector by this date (promptly —
   * evaluation + 7 days). A disputed debt should be paused while investigated.
   */
  disputeCollectorSendBy: Date;
  /** Pause window the dispute requires the collector to observe. */
  collectorPauseDeadline: Date;
  /** Write to the gym asserting the unfair term by this date. */
  letterToGymSendBy: Date;
  /** Reasonable response window the letter to the gym gives. */
  gymResponseDeadline: Date;
  /** Escalate to a formal complaint / ADR / small claim by this date. */
  escalateBy: Date;
  /**
   * 6-year limitation longstop. A creditor cannot enforce a contract debt in
   * court more than 6 years after the cause of action accrued (Limitation Act
   * 1980 s5), measured here from the cancellation attempt (or membership start
   * if no attempt date is known).
   */
  limitationLongstop: Date;
}

export function computeKeyDates(c: UnfairTermsCase): KeyDates {
  const evaluationDate = c.evaluationDate
    ? parseISO(c.evaluationDate)
    : parseISO(new Date().toISOString().slice(0, 10));

  const membershipStartDate = parseISO(c.membership.startDate);
  const minimumTermEndDate = addMonths(membershipStartDate, c.membership.minimumTermMonths);

  const cancellationAttemptDate = c.cancellationAttemptDate
    ? parseISO(c.cancellationAttemptDate)
    : undefined;
  const debtLetterDate = c.debt.letterDate ? parseISO(c.debt.letterDate) : undefined;

  // Dispute the debt promptly so the collector pauses it; allow them 14 days.
  const disputeCollectorSendBy = addCalendarDays(evaluationDate, 7);
  const collectorPauseDeadline = addCalendarDays(disputeCollectorSendBy, 14);

  // Assert the unfair term to the gym in the same window; give 14 days to reply.
  const letterToGymSendBy = addCalendarDays(evaluationDate, 7);
  const gymResponseDeadline = addCalendarDays(letterToGymSendBy, 14);

  // If unresolved, escalate to a complaint / ADR / small claim.
  const escalateBy = addCalendarDays(evaluationDate, 30);

  // Limitation runs from when the disputed sum was first demanded; use the
  // cancellation attempt, else fall back to the membership start date.
  const limitationLongstop = addYears(
    cancellationAttemptDate ?? membershipStartDate,
    6,
  );

  return {
    evaluationDate,
    membershipStartDate,
    minimumTermEndDate,
    cancellationAttemptDate,
    debtLetterDate,
    disputeCollectorSendBy,
    collectorPauseDeadline,
    letterToGymSendBy,
    gymResponseDeadline,
    escalateBy,
    limitationLongstop,
  };
}
