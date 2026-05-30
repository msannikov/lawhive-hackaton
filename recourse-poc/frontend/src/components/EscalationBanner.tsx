import type { EscalationSignal } from "../types";

const COPY = {
  self_serve: { title: "You can handle this yourself", tone: "ok" },
  monitor: { title: "Self-serve for now — we'll flag when to escalate", tone: "watch" },
  escalate: { title: "Time to bring in a regulated lawyer", tone: "bad" },
} as const;

export default function EscalationBanner({ escalation }: { escalation: EscalationSignal }) {
  const c = COPY[escalation.level];
  return (
    <div className={"escalation-banner tone-" + c.tone}>
      <strong>{c.title}</strong>
      <span>{escalation.reason}</span>
    </div>
  );
}
