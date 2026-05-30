/**
 * Derives every date the decision tree and tools need from the raw case facts.
 * Centralising this keeps deadline logic consistent across all branches.
 */

import type { TenantCase } from "./types.ts";
import {
  parseISO,
  addCalendarDays,
  addWorkingDays,
  addMonths,
  addYears,
  maxDate,
} from "./dates.ts";

export interface KeyDates {
  /** "Today" used for all relative deadlines. */
  evaluationDate: Date;
  /** When the tenant asked for the deposit back. */
  requestDate: Date;
  /** Landlord received the deposit. */
  depositPaidDate: Date;
  /** Statutory 30-day deadline to protect + serve prescribed information. */
  protectionDeadline: Date;
  /** End of tenancy, if known. */
  tenancyEndDate?: Date;
  /** Contractual deadline to return an undisputed deposit (10 working days after tenancy end). */
  contractualReturnDeadline?: Date;
  /** Date the protection duty was breached (used for the s214 limitation longstop). */
  breachDate: Date;
  /** 6-year limitation longstop for a s214 penalty claim. */
  claimLimitationLongstop: Date;
  /** Send a Letter Before Action by this date. */
  letterBeforeActionSendBy: Date;
  /** Reasonable response window the LBA gives the landlord. */
  letterBeforeActionResponseDeadline: Date;
  /** Soft deadline for an initial chase of a silent landlord. */
  chaseBy: Date;
  /** Escalate (formal demand / claim) by this date if still silent. */
  escalateBy: Date;
  /** Raise a scheme ADR dispute by this date (schemes expect prompt action). */
  adrRaiseBy: Date;
}

export function computeKeyDates(c: TenantCase): KeyDates {
  const evaluationDate = c.evaluationDate
    ? parseISO(c.evaluationDate)
    : parseISO(new Date().toISOString().slice(0, 10));

  const requestDate = c.depositRequestDate
    ? parseISO(c.depositRequestDate)
    : evaluationDate;

  const depositPaidDate = parseISO(c.deposit.paidDate);
  const protectionDeadline = addCalendarDays(depositPaidDate, 30);

  const tenancyEndDate = c.tenancy.endDate ? parseISO(c.tenancy.endDate) : undefined;

  // Clause 4.1(d): return within 10 working days after the end of the tenancy.
  // If the tenancy hasn't ended, base it on the request date instead.
  const returnBasis = tenancyEndDate
    ? maxDate(tenancyEndDate, requestDate)
    : requestDate;
  const contractualReturnDeadline = addWorkingDays(returnBasis, 10);

  // The protection duty is breached once the 30-day window closes unprotected.
  const breachDate = protectionDeadline;
  const claimLimitationLongstop = addYears(breachDate, 6);

  const letterBeforeActionSendBy = addCalendarDays(evaluationDate, 7);
  const letterBeforeActionResponseDeadline = addCalendarDays(letterBeforeActionSendBy, 14);

  const chaseBy = addCalendarDays(evaluationDate, 3);
  const escalateBy = addCalendarDays(evaluationDate, 17);

  // Scheme ADR should be raised promptly; 3 months after tenancy end is a safe guide.
  const adrRaiseBy = addMonths(tenancyEndDate ?? evaluationDate, 3);

  return {
    evaluationDate,
    requestDate,
    depositPaidDate,
    protectionDeadline,
    tenancyEndDate,
    contractualReturnDeadline,
    breachDate,
    claimLimitationLongstop,
    letterBeforeActionSendBy,
    letterBeforeActionResponseDeadline,
    chaseBy,
    escalateBy,
    adrRaiseBy,
  };
}
