/**
 * Dependency-free iCalendar (RFC 5545) generation for deadline reminders.
 *
 * Deadlines are calendar DATES, not times, so each becomes an all-day VEVENT
 * (DTSTART;VALUE=DATE) — that renders on the correct day in every timezone, the
 * same UTC-date discipline used end-to-end. Lines use CRLF as the spec requires.
 */

export interface IcsEvent {
  uid: string;
  title: string;
  date: string; // YYYY-MM-DD
  description?: string;
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function ymd(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]}${m[2]}${m[3]}` : iso.replace(/-/g, "");
}

/** All-day DTEND is exclusive, so it's the day after DTSTART. */
function ymdPlusOne(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return ymd(iso);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
}

function nowStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildVEvent(e: IcsEvent): string {
  const stamp = nowStamp();
  return [
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(e.date)}`,
    `DTEND;VALUE=DATE:${ymdPlusOne(e.date)}`,
    `SUMMARY:${esc(e.title)}`,
    e.description ? `DESCRIPTION:${esc(e.description)}` : "",
    "END:VEVENT",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export function buildCalendar(events: IcsEvent[]): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Law Gun//Legal Negotiator//EN",
    "CALSCALE:GREGORIAN",
    ...events.map(buildVEvent),
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(filename: string, events: IcsEvent[]): void {
  const blob = new Blob([buildCalendar(events)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
