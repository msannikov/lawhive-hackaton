export const theme = {
  bg: "#0b1220",
  panel: "#111827",
  panelBorder: "#1e293b",
  text: "#f8fafc",
  muted: "#94a3b8",
  accent: "#38bdf8",
  accentSoft: "#0ea5e933",
  success: "#34d399",
  warning: "#fbbf24",
  danger: "#f87171",
  pipeline: ["#6366f1", "#8b5cf6", "#a855f7", "#22c55e"],
  font: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, monospace',
} as const;

export const formatDeadline = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const escalationColor = (level: string) => {
  switch (level) {
    case "self_serve":
      return theme.success;
    case "monitor":
      return theme.warning;
    case "escalate":
      return theme.danger;
    default:
      return theme.muted;
  }
};
