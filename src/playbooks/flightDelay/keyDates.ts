/**
 * Derives every date the decision tree and tools need from the raw case facts.
 * Centralising this keeps deadline logic consistent across all branches.
 *
 * The hard longstop is the 6-year limitation period for a County Court money
 * claim (England & Wales, Limitation Act 1980 s5) running from the flight date.
 * Everything else (claim/chase/ADR dates) is a sensible self-serve cadence that
 * always sits well inside that longstop.
 */

import type { FlightDelayCase } from "./case.ts";
import { parseISO, addCalendarDays, addYears, maxDate } from "../../core/dates.ts";

export interface KeyDates {
  /** "Today" used for all relative deadlines. */
  evaluationDate: Date;
  /** Scheduled date of the disrupted flight. */
  flightDate: Date;
  /** When the written compensation claim was first submitted (if known). */
  claimSubmittedDate?: Date;
  /** Send / renew the written compensation claim to the airline by this date. */
  claimSendBy: Date;
  /** Reasonable response window the airline is given. */
  airlineResponseDeadline: Date;
  /** Escalate to an ADR scheme (AviationADR / CEDR) / CAA by this date if rejected. */
  adrEscalateBy: Date;
  /** 6-year limitation longstop for a County Court money claim (from the flight). */
  claimLimitationLongstop: Date;
}

export function computeKeyDates(c: FlightDelayCase): KeyDates {
  const evaluationDate = c.evaluationDate
    ? parseISO(c.evaluationDate)
    : parseISO(new Date().toISOString().slice(0, 10));

  const flightDate = parseISO(c.flight.date);

  const claimSubmittedDate = c.claimSubmittedDate
    ? parseISO(c.claimSubmittedDate)
    : undefined;

  // Send (or renew) the written claim promptly — within a week of evaluation.
  const claimSendBy = addCalendarDays(evaluationDate, 7);

  // Airlines should reply within a reasonable time; the CAA expects ~8 weeks
  // before a passenger may take the matter to ADR. Run it from the later of when
  // the claim was actually submitted and the planned send date.
  const responseBasis = claimSubmittedDate
    ? maxDate(claimSubmittedDate, claimSendBy)
    : claimSendBy;
  const airlineResponseDeadline = addCalendarDays(responseBasis, 56); // 8 weeks

  // Once the airline rejects or the 8 weeks lapse, escalate to ADR / CAA.
  const adrEscalateBy = addCalendarDays(airlineResponseDeadline, 14);

  // Limitation longstop: 6 years from the flight (England & Wales).
  const claimLimitationLongstop = addYears(flightDate, 6);

  return {
    evaluationDate,
    flightDate,
    claimSubmittedDate,
    claimSendBy,
    airlineResponseDeadline,
    adrEscalateBy,
    claimLimitationLongstop,
  };
}

/** Fixed UK261 compensation by distance band, in GBP. */
export const COMPENSATION_BY_BAND: Record<FlightDelayCase["flight"]["distanceBand"], number> = {
  le1500: 220,
  "1500to3500": 350,
  gt3500: 520,
};

/** Human-readable description of each band, for reasoning + letters. */
export const BAND_DESCRIPTION: Record<FlightDelayCase["flight"]["distanceBand"], string> = {
  le1500: "1,500 km or less",
  "1500to3500": "1,500–3,500 km",
  gt3500: "more than 3,500 km",
};
