/**
 * Derives every date the decision tree and tools need from the raw case facts.
 * Centralising this keeps deadline logic consistent across all branches.
 *
 * The spine of the timeline is the Pre-Action Protocol for Housing Conditions
 * Claims (England): the tenant sends a Letter of Claim and the landlord then has
 * 20 WORKING DAYS to respond and disclose its records. Limitation runs 6 years
 * (contract — s11 / fitness) and 3 years for any personal-injury element.
 */

import type { HousingDisrepairCase } from "./case.ts";
import {
  parseISO,
  addCalendarDays,
  addWorkingDays,
  addYears,
} from "../../core/dates.ts";

/** Days a court treats as a "reasonable time" to fix serious damp once reported. */
const REASONABLE_REPAIR_DAYS = 28;
/** Pre-Action Protocol: landlord's window to respond + disclose records. */
const PROTOCOL_RESPONSE_WORKING_DAYS = 20;

export interface KeyDates {
  /** "Today" used for all relative deadlines. */
  evaluationDate: Date;
  /** Tenancy start (anchors the 6-year contractual limitation period). */
  tenancyStartDate: Date;
  /** Date the tenant first notified the landlord (starts the repair clock). */
  firstReportedDate: Date;
  /** A "reasonable time to repair" expires ~28 days after notification. */
  reasonableRepairDeadline: Date;
  /** Send the Pre-Action Protocol Letter of Claim by this date. */
  letterOfClaimSendBy: Date;
  /** Landlord's protocol response deadline: 20 working days after the Letter of Claim. */
  protocolResponseDeadline: Date;
  /** Issue County Court proceedings by this date if still unremedied. */
  issueProceedingsBy: Date;
  /** 6-year limitation longstop for the contractual (s11 / fitness) claim. */
  contractLimitationLongstop: Date;
  /** 3-year limitation longstop for any personal-injury (health) element. */
  personalInjuryLimitationLongstop: Date;
  /** Push the council EHO / urgent works by this date (urgent-risk branch). */
  urgentEscalateBy: Date;
}

export function computeKeyDates(c: HousingDisrepairCase): KeyDates {
  const evaluationDate = c.evaluationDate
    ? parseISO(c.evaluationDate)
    : parseISO(new Date().toISOString().slice(0, 10));

  const tenancyStartDate = parseISO(c.tenancy.startDate);
  const firstReportedDate = parseISO(c.disrepair.firstReportedDate);

  // Once notified, the landlord has a "reasonable time" to repair. For serious
  // damp / mould 28 days is a defensible benchmark; the clock starts at report.
  const reasonableRepairDeadline = addCalendarDays(firstReportedDate, REASONABLE_REPAIR_DAYS);

  // Send the Letter of Claim promptly once the reasonable repair window has
  // lapsed; from the evaluation date we give a 7-day lead.
  const letterOfClaimSendBy = addCalendarDays(evaluationDate, 7);

  // Pre-Action Protocol: 20 working days for the landlord to respond + disclose.
  const protocolResponseDeadline = addWorkingDays(letterOfClaimSendBy, PROTOCOL_RESPONSE_WORKING_DAYS);

  // Issue proceedings shortly after the protocol window closes unremedied.
  const issueProceedingsBy = addCalendarDays(protocolResponseDeadline, 14);

  // Limitation: 6 years from breach (the unrepaired condition is a continuing
  // breach, so the start of the disrepair is the safe lower bound); 3 years for
  // the personal-injury element, running from when the harm became known.
  const contractLimitationLongstop = addYears(firstReportedDate, 6);
  const personalInjuryLimitationLongstop = addYears(firstReportedDate, 3);

  // Urgent health-risk escalation should be pushed within days, not weeks.
  const urgentEscalateBy = addCalendarDays(evaluationDate, 3);

  return {
    evaluationDate,
    tenancyStartDate,
    firstReportedDate,
    reasonableRepairDeadline,
    letterOfClaimSendBy,
    protocolResponseDeadline,
    issueProceedingsBy,
    contractLimitationLongstop,
    personalInjuryLimitationLongstop,
    urgentEscalateBy,
  };
}
