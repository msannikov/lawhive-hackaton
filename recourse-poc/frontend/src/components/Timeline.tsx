import type { CaseAssessment } from "../types";
import { formatDate, daysUntil } from "../lib/date";
import { downloadIcs, type IcsEvent } from "../lib/ics";

interface Props {
  assessment: CaseAssessment;
  onOpenTool: (id: string) => void;
}

interface Item {
  date: string;
  label: string;
  kind: "tool" | "context";
  basis?: string;
  toolId?: string;
}

export default function Timeline({ assessment, onOpenTool }: Props) {
  const items: Item[] = [];

  // Engine key dates (limitation, protection deadline, …) as context markers.
  for (const [label, date] of Object.entries(assessment.keyDates)) {
    if (/^\d{4}-\d{2}-\d{2}/.test(date)) items.push({ date, label, kind: "context" });
  }
  // Tool deadlines — the actionable steps.
  for (const t of assessment.tools) {
    items.push({ date: t.deadline, label: t.title, kind: "tool", basis: t.deadlineBasis, toolId: t.id });
  }
  items.sort((a, b) => a.date.localeCompare(b.date));

  function exportAll() {
    // Only export upcoming dates — past context markers aren't reminders.
    const events: IcsEvent[] = items
      .filter((it) => daysUntil(it.date) >= 0)
      .map((it, i) => ({ uid: `recourse-${i}-${it.date}`, title: it.label, date: it.date, description: it.basis }));
    if (events.length) downloadIcs("recourse-deadlines", events);
  }

  return (
    <div className="timeline card">
      <div className="timeline-head">
        <h3>Key dates</h3>
        <button type="button" className="cal-btn" onClick={exportAll}>
          Export all (.ics)
        </button>
      </div>
      <ol className="timeline-list">
        {items.map((it, i) => {
          const days = daysUntil(it.date);
          const urgency =
            it.kind === "context" ? "context" : days < 0 ? "overdue" : days <= 7 ? "soon" : days <= 30 ? "near" : "ample";
          return (
            <li key={i} className={"timeline-item urgency-" + urgency}>
              <span className="ti-date">{formatDate(it.date)}</span>
              {it.toolId ? (
                <button type="button" className="ti-link" onClick={() => onOpenTool(it.toolId!)}>
                  {it.label}
                </button>
              ) : (
                <span className="ti-label">{it.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
