/**
 * Small, dependency-free date helpers. All dates are handled in UTC so that
 * deadline arithmetic is stable regardless of the host machine's timezone.
 *
 * Working-day math skips weekends only; UK bank holidays are not modelled, so a
 * computed working-day deadline is a safe lower bound (the real one is never
 * earlier).
 */

import type { ISODate } from "./types.ts";

export function parseISO(d: ISODate): Date {
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) throw new Error(`Invalid ISO date: ${d}`);
  return new Date(Date.UTC(y, m - 1, day));
}

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addCalendarDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

export function addYears(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCFullYear(r.getUTCFullYear() + n);
  return r;
}

/** Adds `n` working days (Mon–Fri), skipping Saturdays and Sundays. */
export function addWorkingDays(d: Date, n: number): Date {
  const r = new Date(d);
  let added = 0;
  while (added < n) {
    r.setUTCDate(r.getUTCDate() + 1);
    const day = r.getUTCDay();
    if (day !== 0 && day !== 6) added++;
  }
  return r;
}

/** Returns the later of two dates. */
export function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

export function isAfter(a: Date, b: Date): boolean {
  return a.getTime() > b.getTime();
}

/** Whole calendar days from `a` to `b` (negative if `b` is before `a`). */
export function daysBetween(a: Date, b: Date): number {
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / MS);
}

const UK_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Formats a date as e.g. "13 May 2024". */
export function formatUK(d: Date): string {
  return `${d.getUTCDate()} ${UK_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
