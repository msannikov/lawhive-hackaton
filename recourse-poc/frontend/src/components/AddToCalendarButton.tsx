import { downloadIcs } from "../lib/ics";

interface Props {
  uid: string;
  title: string;
  date: string;
  description?: string;
  label?: string;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "reminder";
}

export default function AddToCalendarButton({ uid, title, date, description, label }: Props) {
  return (
    <button
      type="button"
      className="cal-btn"
      onClick={() => downloadIcs(slug(title), [{ uid, title, date, description }])}
    >
      {label ?? "Add to calendar"}
    </button>
  );
}
