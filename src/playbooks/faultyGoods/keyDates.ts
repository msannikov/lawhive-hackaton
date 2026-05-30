/**
 * Derives every date the decision tree and tools need from the raw case facts.
 * Centralising this keeps deadline logic consistent across all branches.
 *
 * THE key date is the 30-day short-term right to reject (CRA 2015 s22): it runs
 * for 30 calendar days from the LATER of delivery/ownership and the goods being
 * made conformant — for a single faulty item, that is simply 30 days from the
 * purchase/delivery date.
 */

import type { FaultyGoodsCase } from "./case.ts";
import { parseISO, addCalendarDays, addYears } from "../../core/dates.ts";

/** Returns the earlier of two dates. */
function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

export interface KeyDates {
  /** "Today" used for all relative deadlines. */
  evaluationDate: Date;
  /** Date ownership transferred / goods delivered — starts the 30-day clock. */
  purchaseDate: Date;
  /** When the fault first appeared / was noticed, if known. */
  faultAppearedDate?: Date;
  /** CRA 2015 s22: last day of the 30-day short-term right to reject. */
  rejectWindowEnd: Date;
  /** True iff the fault appeared on or before the 30-day window closes. */
  withinRejectWindow: boolean;
  /** Send the written rejection / repair-or-replace demand by this date. */
  notifyDealerBy: Date;
  /** Send a Letter Before Claim by this date if the dealer does not put it right. */
  letterBeforeClaimSendBy: Date;
  /** Reasonable response window the LBC gives the dealer (14 days). */
  letterBeforeClaimResponseDeadline: Date;
  /** Raise a Motor Ombudsman ADR case by this date. */
  adrRaiseBy: Date;
  /** 6-year limitation longstop for a CRA breach-of-contract claim. */
  claimLimitationLongstop: Date;
}

export function computeKeyDates(c: FaultyGoodsCase): KeyDates {
  const evaluationDate = c.evaluationDate
    ? parseISO(c.evaluationDate)
    : parseISO(new Date().toISOString().slice(0, 10));

  const purchaseDate = parseISO(c.purchase.purchaseDate);

  // CRA 2015 s22(3): the 30-day window runs for 30 days from delivery/ownership.
  const rejectWindowEnd = addCalendarDays(purchaseDate, 30);

  const faultAppearedDate = c.fault.dateAppeared
    ? parseISO(c.fault.dateAppeared)
    : undefined;

  // The short-term right to reject is available only if the fault arose within
  // the 30-day window. If we don't know when it appeared, fall back to whether
  // we are still inside the window at evaluation (conservative).
  const withinRejectWindow = faultAppearedDate
    ? faultAppearedDate.getTime() <= rejectWindowEnd.getTime()
    : evaluationDate.getTime() <= rejectWindowEnd.getTime();

  // Reject/repair notice should go out promptly. While the short-term right is
  // still live, send within ~3 days of evaluation but never after the window
  // closes (whichever is sooner). Otherwise just send within ~3 days.
  const promptly = addCalendarDays(evaluationDate, 3);
  const notifyDealerBy = withinRejectWindow ? minDate(promptly, rejectWindowEnd) : promptly;

  const letterBeforeClaimSendBy = addCalendarDays(evaluationDate, 7);
  const letterBeforeClaimResponseDeadline = addCalendarDays(letterBeforeClaimSendBy, 14);

  // Motor Ombudsman expects the trader's complaints process to be exhausted; a
  // prompt referral after the LBC window is the safe guide.
  const adrRaiseBy = addCalendarDays(letterBeforeClaimResponseDeadline, 7);

  // CRA breach-of-contract claims: 6-year limitation longstop from purchase.
  const claimLimitationLongstop = addYears(purchaseDate, 6);

  return {
    evaluationDate,
    purchaseDate,
    faultAppearedDate,
    rejectWindowEnd,
    withinRejectWindow,
    notifyDealerBy,
    letterBeforeClaimSendBy,
    letterBeforeClaimResponseDeadline,
    adrRaiseBy,
    claimLimitationLongstop,
  };
}
