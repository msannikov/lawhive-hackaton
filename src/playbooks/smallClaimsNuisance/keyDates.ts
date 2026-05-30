/**
 * Derives every date the decision tree and tools need from the raw case facts.
 * Centralising this keeps the (strict, unforgiving) CPR deadline logic consistent
 * across all branches.
 *
 * The hard deadline here is the APPEAL longstop: an appellant's notice must be
 * filed within 21 days of the decision (CPR 52.12), so we compute it from the
 * judgment date. Relief from sanctions (CPR 3.9) and set-aside (CPR 13.3 / 39.3)
 * have no fixed number of days but must be made PROMPTLY — modelled as a tight
 * "as soon as possible" window from the evaluation date.
 */

import type { SmallClaimsNuisanceCase } from "./case.ts";
import { parseISO, addCalendarDays, maxDate, isAfter } from "../../core/dates.ts";

/** Appellant's notice must be filed within 21 days of the decision (CPR 52.12). */
export const APPEAL_LIMIT_DAYS = 21;

/** A set-aside application under CPR 39.3 (non-attendance) must be made promptly;
 * 14 days from notice of the order is the longstop the rule itself imposes. */
export const SET_ASIDE_39_3_DAYS = 14;

export interface KeyDates {
  /** "Today" used for all relative deadlines. */
  evaluationDate: Date;
  /** Date the directions order was made, if known. */
  orderDate?: Date;
  /** Final-hearing date, if listed. */
  finalHearingDate?: Date;
  /** The directions deadline that was missed, if any. */
  missedDeadlineDate?: Date;
  /** The next directions deadline still in the future (the one to comply with). */
  nextDirectionsStep?: { step: string; date: Date };
  /** Date a judgment/order was made against the party, if any. */
  judgmentDate?: Date;
  /** Hard deadline: file the appellant's notice within 21 days of the decision. */
  appealLongstop?: Date;
  /** Longstop for a CPR 39.3 set-aside (non-attendance): 14 days from the order. */
  setAsideLongstop?: Date;
  /** File the relief-from-sanctions / set-aside application by here ("as soon as possible"). */
  applyBy: Date;
  /** File the outstanding (missed) document by here — immediately. */
  fileOutstandingDocBy: Date;
}

export function computeKeyDates(c: SmallClaimsNuisanceCase): KeyDates {
  const evaluationDate = c.evaluationDate
    ? parseISO(c.evaluationDate)
    : parseISO(new Date().toISOString().slice(0, 10));

  const orderDate = c.directions.orderDate ? parseISO(c.directions.orderDate) : undefined;
  const finalHearingDate = c.directions.finalHearingDate
    ? parseISO(c.directions.finalHearingDate)
    : undefined;
  const missedDeadlineDate = c.missedDeadline ? parseISO(c.missedDeadline.dueDate) : undefined;
  const judgmentDate = c.judgment ? parseISO(c.judgment.date) : undefined;

  // The next directions step still in the future (earliest deadline after today).
  const nextDirectionsStep = c.directions.deadlines
    .map((d) => ({ step: d.step, date: parseISO(d.date) }))
    .filter((d) => isAfter(d.date, evaluationDate))
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  // THE key hard deadline: appellant's notice within 21 days of the decision.
  const appealLongstop = judgmentDate ? addCalendarDays(judgmentDate, APPEAL_LIMIT_DAYS) : undefined;

  // CPR 39.3 set-aside longstop (non-attendance): 14 days from the order.
  const setAsideLongstop = judgmentDate
    ? addCalendarDays(judgmentDate, SET_ASIDE_39_3_DAYS)
    : undefined;

  // Relief / set-aside must be made PROMPTLY — model "as soon as possible" as a
  // tight window (evaluation + 3 days), but never later than the appeal longstop.
  let applyBy = addCalendarDays(evaluationDate, 3);
  if (appealLongstop && isAfter(applyBy, appealLongstop)) applyBy = appealLongstop;

  // The outstanding (missed) document should be filed immediately.
  const fileOutstandingDocBy = maxDate(evaluationDate, addCalendarDays(evaluationDate, 1));

  return {
    evaluationDate,
    orderDate,
    finalHearingDate,
    missedDeadlineDate,
    nextDirectionsStep,
    judgmentDate,
    appealLongstop,
    setAsideLongstop,
    applyBy,
    fileOutstandingDocBy,
  };
}
