import type { Tool } from "../types";
import { formatDate, daysUntil } from "../lib/date";

const ICON: Record<string, string> = {
  verify: "🔍",
  evidence: "📎",
  letter: "✉️",
  chase: "📨",
  negotiation: "🤝",
  adr: "⚖️",
  court: "🏛️",
};

export default function ToolCard({ tool, onOpen }: { tool: Tool; onOpen: () => void }) {
  const days = daysUntil(tool.deadline);
  const urgency = days < 0 ? "overdue" : days <= 7 ? "soon" : days <= 30 ? "near" : "ample";

  return (
    <button type="button" className={"tool-card urgency-" + urgency} onClick={onOpen}>
      <span className="tool-icon" aria-hidden>
        {ICON[tool.category] ?? "•"}
      </span>
      <span className="tool-title">{tool.title}</span>
      <span className="tool-action">{tool.nextAction}</span>
      <span className="tool-deadline">
        <span aria-hidden>📅</span> {formatDate(tool.deadline)}
        <em className="tool-deadline-basis">{tool.deadlineBasis}</em>
      </span>
    </button>
  );
}
