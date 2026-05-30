import { formatDate, daysUntil } from "../lib/date";
import AddToCalendarButton from "./AddToCalendarButton";

interface Props {
  date: string;
  basis?: string;
  /** When set, shows an "Add to calendar" button for this deadline. */
  calendarTitle?: string;
  calendarDescription?: string;
  uid?: string;
}

export default function DeadlineChip({ date, basis, calendarTitle, calendarDescription, uid }: Props) {
  const days = daysUntil(date);
  const rel = isNaN(days)
    ? ""
    : days < 0
      ? `${Math.abs(days)} days ago`
      : days === 0
        ? "today"
        : `in ${days} days`;
  const urgency = isNaN(days) ? "ample" : days < 0 ? "overdue" : days <= 7 ? "soon" : days <= 30 ? "near" : "ample";

  return (
    <div className={"deadline-chip urgency-" + urgency}>
      <span aria-hidden>📅</span>
      <span className="dc-date">
        <strong>{formatDate(date)}</strong>
        {rel && <span className="dc-rel"> ({rel})</span>}
      </span>
      {basis && <span className="dc-basis">{basis}</span>}
      {calendarTitle && (
        <AddToCalendarButton uid={uid ?? `${calendarTitle}-${date}`} title={calendarTitle} date={date} description={calendarDescription} />
      )}
    </div>
  );
}
