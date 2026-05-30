/**
 * Deadline engine (spec §3.5) — pure function `case → DeadlineResult`.
 *
 * Limitation runs 6 years from day 31 after the deposit was received
 * (Limitation Act 1980 s.9; Lowe v Sutton's Hospital, R10):
 *     limitation_expiry = date_deposit_paid + 30 days + 6 years
 * The end-of-tenancy start-date argument is untested, so we compute from the
 * earlier (day-31) date and always carry an uncertainty_flag.
 *
 * Timezone safety: dates are parsed as LOCAL midnight (numeric constructor, not
 * the string constructor, which would parse as UTC and shift the calendar day in
 * non-UTC timezones). date-fns then operates consistently in local time, and
 * differenceInCalendarDays compares calendar dates — so results are identical
 * regardless of the machine's timezone, which is what the tests rely on.
 */
import { addDays, addYears, differenceInCalendarDays, format } from "date-fns";
import type { DepositCase, DeadlineResult, DeadlineStatus } from "../models";

function parseLocalDate(s: string): Date {
  const parts = s.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, m - 1, d); // local midnight
}

/** Status bands from §3.5. critical (<30d) is an escalation trigger. */
function statusFor(daysRemaining: number): DeadlineStatus {
  if (daysRemaining < 30) return "critical";
  if (daysRemaining < 90) return "urgent";
  if (daysRemaining <= 180) return "watch";
  return "ample";
}

export function computeDeadline(c: DepositCase, today: Date = new Date()): DeadlineResult {
  const paid = parseLocalDate(c.date_deposit_paid);
  const expiry = addYears(addDays(paid, 30), 6);
  const days_remaining = differenceInCalendarDays(expiry, today);

  return {
    limitation_expiry: format(expiry, "yyyy-MM-dd"),
    days_remaining,
    status: statusFor(days_remaining),
    lbc_response_deadline: format(addDays(today, 14), "yyyy-MM-dd"), // R13 default 14-day window
    uncertainty_flag: true,
    basis: ["R10"],
  };
}
