import { AbsoluteFill, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CaptionTrack, type Caption } from "./components/captions";

/* Light tokens to match the real Law Gun UI */
const c = {
  ink: "#1a1c20",
  muted: "#5c6470",
  bg: "#f5f6f8",
  accent: "#2b50aa",
  green: "#1f8b4c",
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

/** A real screenshot, scaled to frame width, with a slow vertical pan + subtle zoom. */
const Shot: React.FC<{ file: string; h: number; pan: number; dur: number }> = ({ file, h, pan, dur }) => {
  const frame = useCurrentFrame();
  const ty = interpolate(frame, [0, dur], [0, pan], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sc = interpolate(frame, [0, dur], [1, 1.02], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const o = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: c.bg, overflow: "hidden", opacity: o }}>
      <Img
        src={staticFile(file)}
        style={{ position: "absolute", top: 0, left: 0, width: 1920, height: h, transform: `translateY(${ty}px) scale(${sc})`, transformOrigin: "top center" }}
      />
    </AbsoluteFill>
  );
};

const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const subO = interpolate(frame, [18, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: c.bg, fontFamily: c.sans, color: c.ink, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `scale(${s})`, textAlign: "center" }}>
        <div style={{ fontSize: 108, fontWeight: 800, letterSpacing: "-1.5px" }}>Law Gun</div>
        <div style={{ fontSize: 32, color: c.muted, opacity: subO, marginTop: 14 }}>Your pocket legal negotiator — know your next move, and the date it's due.</div>
      </div>
    </AbsoluteFill>
  );
};

const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: c.bg, fontFamily: c.sans, color: c.ink, justifyContent: "center", alignItems: "center", opacity: o }}>
      <div style={{ textAlign: "center", maxWidth: 1100 }}>
        <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: "-1px" }}>Law Gun</div>
        <div style={{ fontSize: 30, color: c.muted, margin: "16px 0 34px" }}>No hallucinated law. Real statute, every time.</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          {["Reads your documents", "Dated action plan", "Verified Letter Before Action"].map((p) => (
            <span key={p} style={{ background: "#e7f4ec", color: c.green, border: "1px solid #bfe3cd", borderRadius: 999, padding: "9px 18px", fontSize: 17, fontWeight: 600 }}>{p}</span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const lawgunCaptions: Caption[] = [
  { from: 83, durationInFrames: 136, text: "Law Gun covers real legal problems — start by picking yours." },
  { from: 233, durationInFrames: 166, text: "Tell it about your tenancy — or drop your documents in and it reads them for you." },
  { from: 413, durationInFrames: 196, text: "You get a dated action plan: every step, with the exact date it's due." },
  { from: 623, durationInFrames: 196, text: "It drafts your Letter Before Action — and checks every legal line against the law." },
  { from: 833, durationInFrames: 256, text: "Click any underlined line — see the exact words of the Housing Act, highlighted and verified." },
  { from: 1101, durationInFrames: 78, text: "No hallucinated law. Real statute, every time. That's Law Gun." },
];

const Scenes: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={75}><TitleScene /></Sequence>
    <Sequence from={75} durationInFrames={150}><Shot file="screens/01-landing.png" h={1200} pan={-110} dur={150} /></Sequence>
    <Sequence from={225} durationInFrames={180}><Shot file="screens/03-intake.png" h={1983} pan={-820} dur={180} /></Sequence>
    <Sequence from={405} durationInFrames={210}><Shot file="screens/04-plan.png" h={1717} pan={-620} dur={210} /></Sequence>
    <Sequence from={615} durationInFrames={210}><Shot file="screens/05-letter.png" h={3672} pan={-820} dur={210} /></Sequence>
    <Sequence from={825} durationInFrames={270}><Shot file="screens/06-drawer.png" h={1200} pan={-110} dur={270} /></Sequence>
    <Sequence from={1095} durationInFrames={90}><OutroScene /></Sequence>
  </AbsoluteFill>
);

export const LawGunDemo: React.FC = () => (
  <AbsoluteFill>
    <Scenes />
    <CaptionTrack captions={lawgunCaptions} />
  </AbsoluteFill>
);
