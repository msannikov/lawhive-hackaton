import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

export const FadeIn: React.FC<{
  children: React.ReactNode;
  start?: number;
  duration?: number;
  delay?: number;
  style?: React.CSSProperties;
}> = ({ children, start = 0, duration = 20, delay = 0, style }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [start + delay, start + delay + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(frame, [start + delay, start + delay + duration], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ opacity, transform: `translateY(${translateY}px)`, ...style }}>{children}</div>
  );
};

export const Panel: React.FC<{
  children: React.ReactNode;
  title?: string;
  style?: React.CSSProperties;
}> = ({ children, title, style }) => (
  <div
    style={{
      background: theme.panel,
      border: `1px solid ${theme.panelBorder}`,
      borderRadius: 16,
      padding: 28,
      boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
      ...style,
    }}
  >
    {title ? (
      <div
        style={{
          fontSize: 14,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: theme.muted,
          marginBottom: 16,
          fontFamily: theme.font,
        }}
      >
        {title}
      </div>
    ) : null}
    {children}
  </div>
);

export const StepBadge: React.FC<{ index: number; label: string; active?: boolean }> = ({
  index,
  label,
  active = false,
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        display: "grid",
        placeItems: "center",
        fontFamily: theme.mono,
        fontWeight: 700,
        fontSize: 16,
        background: active ? theme.accent : theme.panelBorder,
        color: active ? theme.bg : theme.text,
      }}
    >
      {index}
    </div>
    <span
      style={{
        fontFamily: theme.font,
        fontSize: 22,
        fontWeight: 600,
        color: active ? theme.text : theme.muted,
      }}
    >
      {label}
    </span>
  </div>
);

export const Pill: React.FC<{ text: string; color?: string }> = ({ text, color = theme.accent }) => (
  <span
    style={{
      display: "inline-block",
      padding: "6px 14px",
      borderRadius: 999,
      background: `${color}22`,
      color,
      border: `1px solid ${color}55`,
      fontFamily: theme.mono,
      fontSize: 14,
      fontWeight: 600,
    }}
  >
    {text}
  </span>
);
