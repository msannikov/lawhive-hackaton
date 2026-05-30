/**
 * Derives every date the decision tree and tools need from the raw case facts.
 *
 * The centrepiece is the Employment Tribunal (ET1) time limit and the ACAS
 * "stop the clock" extension. Getting this right is the whole point of the
 * playbook, so the method is written out explicitly:
 *
 *   PRIMARY LIMIT (s111(2) ERA 1996 / s123 Equality Act 2010):
 *     the effective date of termination (EDT) — or the discriminatory act —
 *     PLUS 3 months LESS 1 day.
 *
 *   ACAS STOP-THE-CLOCK (s207B ERA 1996 / s140B Equality Act 2010):
 *     mandatory Early Conciliation pauses the clock. With Day A = the date ACAS
 *     received the EC notification and Day B = the date the certificate was
 *     issued, the limit is extended in TWO ways and the claimant gets the more
 *     generous of them:
 *       (i)  s207B(3): time that elapses BETWEEN Day A and Day B does not count
 *            — but only the part of it that falls WHILE THE LIMITATION CLOCK IS
 *            RUNNING (i.e. on/after the anchor). So add (Day B − max(Day A,
 *            anchor)) days onto the primary limit; and
 *       (ii) s207B(4): if the primary limit WOULD OTHERWISE EXPIRE in the window
 *            from Day A to one month after Day B, it is pushed out to ONE MONTH
 *            AFTER Day B.
 *     s207B only ever EXTENDS the primary limit — it can never bring it forward.
 *     Crucially, where EC was started and FINISHED before the primary limit even
 *     began to run (Day B on/before the EDT), no part of the conciliation period
 *     falls within the limitation period and the s207B(4) floor does not bite, so
 *     the PRIMARY limit governs unchanged. We therefore take the LATER of the
 *     primary limit and whichever extension methods apply (never earlier).
 */

import type { UnfairDismissalCase } from "./case.ts";
import {
  parseISO,
  addCalendarDays,
  addMonths,
  addYears,
  daysBetween,
  maxDate,
  isAfter,
} from "../../core/dates.ts";

export interface KeyDates {
  /** "Today" used for all relative deadlines. */
  evaluationDate: Date;
  /** Start of continuous service. */
  startDate: Date;
  /** Effective date of termination (EDT) — anchor for the ET1 limit. */
  endDate?: Date;
  /** Date that anchors the ET1 limit (EDT, falling back to evaluation date). */
  limitAnchor: Date;
  /** Continuous service in whole years at the EDT (0 if EDT unknown). */
  serviceYears: number;
  /** True iff continuous service reaches the 2-year unfair-dismissal threshold. */
  hasTwoYearsService: boolean;
  /** Primary ET1 limit: anchor + 3 months − 1 day. */
  primaryEtLimit: Date;
  /** ACAS Day A (EC notification), if known. */
  acasDayA?: Date;
  /** ACAS Day B (certificate issued), if known. */
  acasDayB?: Date;
  /** Whole days the clock was paused (Day B − Day A); 0 if unknown/invalid. */
  acasStopDays: number;
  /** The final ET1 limit after applying the ACAS stop-the-clock. */
  etLimit: Date;
  /** True iff the ACAS extension actually moved the limit out. */
  acasExtended: boolean;
  /** Deadline to decide on / respond to the settlement offer. */
  settlementDecideBy: Date;
  /** Gather the evidence bundle by this date. */
  evidenceBy: Date;
  /** Take specialist advice by this date (well before the ET1 limit). */
  adviceBy: Date;
}

export function computeKeyDates(c: UnfairDismissalCase): KeyDates {
  const evaluationDate = c.evaluationDate
    ? parseISO(c.evaluationDate)
    : parseISO(new Date().toISOString().slice(0, 10));

  const startDate = parseISO(c.employment.startDate);
  const endDate = c.employment.endDate ? parseISO(c.employment.endDate) : undefined;

  // The ET1 limit anchors on the EDT; if unknown, fall back to evaluation date.
  const limitAnchor = endDate ?? evaluationDate;

  // --- Qualifying service for "ordinary" unfair dismissal (2 years) ---
  const serviceEnd = endDate ?? evaluationDate;
  const serviceYears = wholeYearsBetween(startDate, serviceEnd);
  const hasTwoYearsService = !isAfter(addYears(startDate, 2), serviceEnd);

  // --- PRIMARY LIMIT: anchor + 3 months − 1 day ---
  const primaryEtLimit = addCalendarDays(addMonths(limitAnchor, 3), -1);

  // --- ACAS stop-the-clock ---
  const acasDayA = c.acas.notificationDate ? parseISO(c.acas.notificationDate) : undefined;
  const acasDayB = c.acas.certificateDate ? parseISO(c.acas.certificateDate) : undefined;

  // s207B only stops time that elapses WHILE THE LIMITATION CLOCK IS RUNNING.
  // The clock starts on the anchor (EDT). So only the part of the conciliation
  // period falling on/after the anchor is "paused": from max(Day A, anchor) to
  // Day B. Where EC finished before the EDT (Day B <= anchor), zero days count —
  // this is the "contacted before the primary limit began to run" case, where
  // s207B cannot move the limit at all.
  let acasStopDays = 0;
  if (acasDayA && acasDayB && !isAfter(acasDayA, acasDayB)) {
    const pauseStart = maxDate(acasDayA, limitAnchor);
    if (isAfter(acasDayB, pauseStart)) acasStopDays = daysBetween(pauseStart, acasDayB);
  }

  // Method (i) — s207B(3): add the in-period paused days onto the primary limit.
  const extByPausedDays = addCalendarDays(primaryEtLimit, acasStopDays);

  // Method (ii) — s207B(4): if the primary limit WOULD OTHERWISE EXPIRE in the
  // window from Day A to one month after Day B, it is pushed out to one month
  // after Day B. The floor only bites when that condition holds.
  const oneMonthAfterB = acasDayB ? addMonths(acasDayB, 1) : primaryEtLimit;
  const floorApplies =
    !!acasDayA &&
    !!acasDayB &&
    !isAfter(acasDayA, primaryEtLimit) && // primary limit on/after Day A
    !isAfter(primaryEtLimit, oneMonthAfterB); // and on/before one month after Day B

  // s207B only EXTENDS: never earlier than the primary limit.
  const etLimit =
    acasDayA && acasDayB
      ? maxDate(primaryEtLimit, maxDate(extByPausedDays, floorApplies ? oneMonthAfterB : primaryEtLimit))
      : primaryEtLimit;
  const acasExtended = isAfter(etLimit, primaryEtLimit);

  // --- Action deadlines (relative to evaluation, capped before the ET1 limit) ---
  const evidenceBy = addCalendarDays(evaluationDate, 7);

  // Decide on the offer by its stated acceptance date if any, else 14 days out,
  // but never later than the ET1 limit (the offer is worthless after the claim
  // is time-barred).
  const statedAcceptBy = c.settlement.acceptByDate
    ? parseISO(c.settlement.acceptByDate)
    : undefined;
  const settlementDecideBy = earliest(
    statedAcceptBy ?? addCalendarDays(evaluationDate, 14),
    etLimit,
  );

  // Take specialist advice well before the deadline: 14 days before the ET1
  // limit, but no earlier than the evaluation date.
  const adviceBy = maxDate(addCalendarDays(etLimit, -14), evaluationDate);

  return {
    evaluationDate,
    startDate,
    endDate,
    limitAnchor,
    serviceYears,
    hasTwoYearsService,
    primaryEtLimit,
    acasDayA,
    acasDayB,
    acasStopDays,
    etLimit,
    acasExtended,
    settlementDecideBy,
    evidenceBy,
    adviceBy,
  };
}

/** Whole completed years from `a` to `b` (0 if b is before a). */
function wholeYearsBetween(a: Date, b: Date): number {
  if (isAfter(a, b)) return 0;
  let years = b.getUTCFullYear() - a.getUTCFullYear();
  if (isAfter(addYears(a, years), b)) years -= 1;
  return Math.max(0, years);
}

function earliest(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}
