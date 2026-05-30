import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

export interface Caption {
  /** Global timeline frame this caption appears. */
  from: number;
  durationInFrames: number;
  text: string;
}

/**
 * Subtitle / narration track. Rendered once at the top level (outside any
 * Sequence) so `useCurrentFrame` is the global timeline frame. Picks the active
 * caption for the current frame and fades it in/out.
 */
export const CaptionTrack: React.FC<{ captions: Caption[] }> = ({ captions }) => {
  const frame = useCurrentFrame();
  const active = captions.find((c) => frame >= c.from && frame < c.from + c.durationInFrames);
  if (!active) return null;

  const local = frame - active.from;
  const fade = Math.min(
    interpolate(local, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(local, [active.durationInFrames - 12, active.durationInFrames], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 48,
        display: "flex",
        justifyContent: "center",
        padding: "0 110px",
        opacity: fade,
      }}
    >
      <div
        style={{
          maxWidth: 1480,
          background: "rgba(2,6,23,0.86)",
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: 14,
          padding: "16px 30px",
          textAlign: "center",
          fontFamily: theme.font,
          fontSize: 30,
          lineHeight: 1.35,
          fontWeight: 600,
          color: theme.text,
          boxShadow: "0 12px 44px rgba(0,0,0,0.55)",
        }}
      >
        {active.text}
      </div>
    </div>
  );
};

/** Narration script, timed to the scene boundaries (global frames). */
export const demoCaptions: Caption[] = [
  { from: 8, durationInFrames: 78, text: "Jamie's landlord never protected his £980.77 deposit. Law Gun takes the case." },
  { from: 96, durationInFrames: 110, text: "No forms — Jamie just drops his tenancy agreement, bank statement and the three scheme searches." },
  { from: 216, durationInFrames: 140, text: "Law Gun reads the documents and pulls the facts that matter — each one cited to its source." },
  { from: 366, durationInFrames: 200, text: "Your landlord broke the law — you're owed your £980.77 back, plus up to three times more. Here's your plan." },
  { from: 576, durationInFrames: 170, text: "A demand letter written to get a reply — polite, firm, with a clear deadline to return the money." },
  { from: 756, durationInFrames: 200, text: "However your landlord replies — WhatsApp, email, even a voicemail — forward it in and Law Gun reads it for you." },
  { from: 966, durationInFrames: 100, text: "Every reply updates your plan. Most cases end right here — without a lawyer." },
  { from: 1072, durationInFrames: 92, text: "But if they won't pay up, Law Gun tells you exactly when it's time to bring in a lawyer." },
  { from: 1176, durationInFrames: 54, text: "Pre-action, handled. You escalate to a human lawyer only when you truly must." },
];
