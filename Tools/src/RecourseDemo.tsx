import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { recourse, type RecourseClaim } from "./recourse/data";
import { CaptionTrack, type Caption } from "./components/captions";

/* Light design tokens — mirror recourse-poc/frontend/src/styles.css */
const t = {
  ink: "#1a1c20",
  muted: "#5c6470",
  line: "#e2e5ea",
  bg: "#f5f6f8",
  paper: "#ffffff",
  green: "#1f8b4c",
  greenSoft: "#e7f4ec",
  red: "#c0392b",
  amber: "#b8860b",
  accent: "#2b50aa",
  accentSoft: "#eef2fb",
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
};

const claims = recourse.claims;

/* ── Provenance-span text rendering (ported from Letter.tsx) ── */
type Seg = { text: string; claim?: RecourseClaim };
function splitByClaims(text: string): Seg[] {
  const hits = claims
    .map((c) => ({ idx: text.indexOf(c.rendered), len: c.rendered.length, claim: c }))
    .filter((h) => h.idx !== -1)
    .sort((a, b) => a.idx - b.idx);
  const out: Seg[] = [];
  let cur = 0;
  for (const h of hits) {
    if (h.idx < cur) continue;
    if (h.idx > cur) out.push({ text: text.slice(cur, h.idx) });
    out.push({ text: text.slice(h.idx, h.idx + h.len), claim: h.claim });
    cur = h.idx + h.len;
  }
  if (cur < text.length) out.push({ text: text.slice(cur) });
  if (!out.length) out.push({ text });
  return out;
}

const ProvText: React.FC<{ text: string; activeId?: string }> = ({ text, activeId }) => (
  <>
    {splitByClaims(text).map((seg, i) =>
      seg.claim ? (
        <span
          key={i}
          style={{
            background: activeId === seg.claim.claimId ? "#c4e6d1" : t.greenSoft,
            borderBottom: `2px solid ${t.green}`,
            borderRadius: "3px 3px 0 0",
            boxShadow: activeId === seg.claim.claimId ? "0 0 0 2px rgba(31,139,76,0.25)" : undefined,
            padding: "1px 2px",
          }}
        >
          {seg.text}
          <sup style={{ fontSize: 13, color: t.green, marginLeft: 1 }}>✓</sup>
        </span>
      ) : (
        <span key={i}>{seg.text}</span>
      ),
    )}
  </>
);

/* ── App chrome ── */
const Masthead: React.FC = () => (
  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: `2px solid ${t.ink}`, paddingBottom: 18, marginBottom: 26 }}>
    <div>
      <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.5px" }}>{recourse.brand.product}</div>
      <div style={{ color: t.muted, fontSize: 17, marginTop: 4 }}>{recourse.brand.tagline}</div>
    </div>
    <div style={{ display: "flex", gap: 10, alignItems: "center", color: t.muted, fontSize: 16 }}>
      <span style={{ fontWeight: 700, color: t.ink }}>{recourse.caseMeta.deposit}</span>
      <span>deposit at stake</span>
    </div>
  </div>
);

const STEPS = ["Your problem", "Your details", "Assessment", "Letter"];
const Stepper: React.FC<{ step: number }> = ({ step }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 30 }}>
    {STEPS.map((label, i) => {
      const current = i === step;
      const reached = i <= step;
      return (
        <div key={label} style={{ display: "flex", alignItems: "center" }}>
          {i > 0 ? <span style={{ color: t.line, margin: "0 10px" }}>—</span> : null}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 9, color: current ? t.accent : reached ? t.ink : t.muted, fontSize: 17, fontWeight: current ? 650 : 400 }}>
            <span style={{ display: "inline-flex", width: 26, height: 26, alignItems: "center", justifyContent: "center", borderRadius: "50%", fontSize: 14, fontWeight: 700, background: current ? t.accent : reached ? t.accentSoft : t.line, color: current ? "#fff" : reached ? t.accent : t.muted }}>{i + 1}</span>
            {label}
          </span>
        </div>
      );
    })}
  </div>
);

const AppFrame: React.FC<{ step: number; children: ReactNode }> = ({ step, children }) => (
  <AbsoluteFill style={{ background: t.bg, fontFamily: t.sans, color: t.ink }}>
    <div style={{ maxWidth: 1640, margin: "0 auto", padding: "44px 70px", width: "100%" }}>
      <Masthead />
      <Stepper step={step} />
      {children}
    </div>
  </AbsoluteFill>
);

const Card: React.FC<{ title?: string; children: ReactNode; style?: React.CSSProperties }> = ({ title, children, style }) => (
  <div style={{ background: t.paper, border: `1px solid ${t.line}`, borderRadius: 12, padding: "22px 24px", ...style }}>
    {title ? <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.7px", color: t.muted, marginBottom: 14 }}>{title}</div> : null}
    {children}
  </div>
);

const FadeUp: React.FC<{ start: number; children: ReactNode; style?: React.CSSProperties }> = ({ start, children, style }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [start, start + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(frame, [start, start + 16], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <div style={{ opacity: o, transform: `translateY(${y}px)`, ...style }}>{children}</div>;
};

/* ── Scene 1 — Title ── */
const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const subO = interpolate(frame, [22, 42], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cardO = interpolate(frame, [40, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cm = recourse.caseMeta;
  return (
    <AbsoluteFill style={{ background: t.bg, fontFamily: t.sans, color: t.ink, justifyContent: "center", alignItems: "center", padding: 100 }}>
      <div style={{ transform: `scale(${s})`, textAlign: "center", maxWidth: 1280 }}>
        <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: "-1px" }}>{recourse.brand.product}</div>
        <div style={{ fontSize: 30, color: t.muted, opacity: subO, margin: "16px 0 40px", lineHeight: 1.4 }}>{recourse.brand.tagline}</div>
        <div style={{ opacity: cardO, display: "inline-grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18, textAlign: "left" }}>
          {[
            ["Tenant", cm.tenant, t.ink],
            ["Deposit at stake", cm.deposit, t.accent],
            ["Problem found", cm.problem, t.red],
          ].map(([k, v, c]) => (
            <Card key={k as string} style={{ minWidth: 300 }}>
              <div style={{ fontSize: 15, color: t.muted, marginBottom: 8 }}>{k}</div>
              <div style={{ fontSize: 22, fontWeight: 650, color: c as string }}>{v}</div>
            </Card>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ── Scene 2 — Upload / intake ── */
const UploadScene: React.FC = () => (
  <AppFrame step={1}>
    <div style={{ fontSize: 26, fontWeight: 650, marginBottom: 4 }}>Jamie drops in his paperwork</div>
    <div style={{ color: t.muted, fontSize: 17, marginBottom: 22 }}>No forms to fill — Recourse reads the documents and pulls out the facts.</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <FadeUp start={6}>
        <Card title="Documents from the tenant">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {recourse.documents.map((d) => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", border: `1px solid ${t.line}`, borderRadius: 10, background: t.bg }}>
                <span style={{ width: 40, height: 40, borderRadius: 9, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, background: d.kind === "pdf" ? "#fde7e4" : "#e7f4ec", color: d.kind === "pdf" ? t.red : t.green }}>{d.kind.toUpperCase()}</span>
                <span style={{ fontSize: 17 }}>{d.name}</span>
              </div>
            ))}
          </div>
        </Card>
      </FadeUp>
      <FadeUp start={20}>
        <Card title="What Recourse read">
          <div style={{ display: "flex", flexDirection: "column" }}>
            {recourse.extracted.map((e, i) => (
              <FadeUp key={e.label} start={28 + i * 8} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "11px 0", borderBottom: i < recourse.extracted.length - 1 ? `1px solid ${t.line}` : "none" }}>
                <span style={{ color: t.muted, fontSize: 16 }}>{e.label}</span>
                <span style={{ fontWeight: 650, fontSize: 16, textAlign: "right" }}>{e.value}</span>
              </FadeUp>
            ))}
          </div>
        </Card>
      </FadeUp>
    </div>
  </AppFrame>
);

/* ── Scene 3 — Assessment ── */
const AssessmentScene: React.FC = () => {
  const a = recourse.assessment;
  const e = recourse.engines;
  return (
    <AppFrame step={2}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 26, alignItems: "start" }}>
        <div>
          <FadeUp start={4}>
            <span style={{ display: "inline-block", background: t.accentSoft, color: t.accent, fontWeight: 650, fontSize: 16, borderRadius: 999, padding: "6px 16px" }}>{a.branch}</span>
          </FadeUp>
          <FadeUp start={14} style={{ marginTop: 16 }}>
            <div style={{ background: "#fff6e0", color: t.amber, border: "1px solid #f0dca0", borderRadius: 10, padding: "14px 18px" }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{a.escalationTitle}</div>
              <div style={{ fontSize: 15, marginTop: 2 }}>{a.escalationReason}</div>
            </div>
          </FadeUp>
          <FadeUp start={24} style={{ marginTop: 18 }}>
            <div style={{ background: t.accentSoft, border: "1px solid #cdd9f3", borderLeft: `4px solid ${t.accent}`, borderRadius: 10, padding: "16px 18px" }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.6px", color: t.accent, fontWeight: 700 }}>{a.nextMoveLabel}</div>
              <div style={{ fontSize: 19, fontWeight: 650, marginTop: 4 }}>{a.nextMoveTitle}</div>
              <div style={{ fontSize: 15, color: t.muted, marginTop: 4 }}>{a.nextMoveWhy}</div>
              <div style={{ fontSize: 15, marginTop: 8, color: t.accent, fontWeight: 600 }}>{a.nextMoveDue}</div>
            </div>
          </FadeUp>
        </div>
        <FadeUp start={18}>
          <Card title="The numbers — computed, not guessed">
            <span style={{ display: "inline-block", background: "#fff6e0", color: t.amber, fontSize: 13, fontWeight: 700, letterSpacing: "0.5px", borderRadius: 6, padding: "3px 10px", marginBottom: 12 }}>{e.status}</span>
            {[
              ["Deposit", e.deposit],
              ["Penalty (1–3×)", `${e.penaltyLow} – ${e.penaltyHigh}`],
              ["Protect-by deadline", e.protectionDeadline],
              ["Claim deadline", e.limitationDeadline],
              ["Time remaining", e.daysRemaining],
            ].map(([k, v], i) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 0", borderTop: i === 0 ? "none" : `1px solid ${t.line}`, fontSize: 16 }}>
                <span style={{ color: t.muted }}>{k}</span>
                <strong style={{ fontVariantNumeric: "tabular-nums" }}>{v}</strong>
              </div>
            ))}
            <div style={{ fontSize: 13, color: t.muted, marginTop: 12, lineHeight: 1.5 }}>Every figure is computed in code from your dates — the AI never guesses a number.</div>
          </Card>
        </FadeUp>
      </div>
    </AppFrame>
  );
};

/* ── Letter paper ── */
const LetterPaper: React.FC<{ maxBlocks?: number; activeId?: string; dim?: boolean }> = ({ maxBlocks, activeId, dim }) => {
  const blocks = recourse.letter.blocks.slice(0, maxBlocks ?? recourse.letter.blocks.length);
  return (
    <div style={{ background: t.paper, border: `1px solid ${t.line}`, borderRadius: 12, padding: "40px 48px", fontFamily: t.serif, fontSize: 18.5, color: dim ? "#9aa1ab" : "#23262b", lineHeight: 1.6, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      {blocks.map((b, i) => {
        if (b.t === "h2") return <div key={i} style={{ fontSize: 24, fontWeight: 700, margin: "4px 0 6px" }}>{b.s}</div>;
        if (b.t === "meta") return <div key={i} style={{ fontFamily: t.sans, fontSize: 15, color: t.muted, margin: "2px 0" }}>{b.s}</div>;
        if (b.t === "h3") return <div key={i} style={{ fontFamily: t.sans, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.6px", color: t.muted, margin: "22px 0 6px" }}>{b.s}</div>;
        return <p key={i} style={{ margin: "10px 0" }}>{dim ? b.s : <ProvText text={b.s} activeId={activeId} />}</p>;
      })}
    </div>
  );
};

const VerifyBar: React.FC = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, background: t.greenSoft, color: t.green, border: "1px solid #bfe3cd", borderRadius: 8, padding: "12px 16px", fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
    <span style={{ display: "inline-flex", width: 24, height: 24, alignItems: "center", justifyContent: "center", background: t.green, color: "#fff", borderRadius: "50%", fontSize: 14 }}>✓</span>
    <span>{recourse.verifyBar}</span>
    <span style={{ marginLeft: "auto", fontWeight: 500, color: t.muted, background: "#fff", border: `1px solid ${t.line}`, borderRadius: 999, padding: "3px 12px", fontSize: 13 }}>{recourse.verifyChip}</span>
  </div>
);

/* ── Scene 4 — Letter ── */
const LetterScene: React.FC = () => {
  const frame = useCurrentFrame();
  const total = recourse.letter.blocks.length;
  const maxBlocks = Math.floor(interpolate(frame, [10, 200], [2, total + 0.99], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <AppFrame step={3}>
      <div style={{ fontSize: 26, fontWeight: 650, marginBottom: 14 }}>Your Letter Before Claim — drafted &amp; checked</div>
      <FadeUp start={2}><VerifyBar /></FadeUp>
      <FadeUp start={6}><LetterPaper maxBlocks={maxBlocks} /></FadeUp>
    </AppFrame>
  );
};

/* ── highlight the verbatim quote inside the statute text ── */
function highlightQuote(text: string, quote: string): ReactNode {
  const idx = text.toLowerCase().indexOf(quote.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "#fff3a8", padding: "1px 2px", borderRadius: 2 }}>{text.slice(idx, idx + quote.length)}</mark>
      {text.slice(idx + quote.length)}
    </>
  );
}

/* ── Scene 5 — Provenance drawer (the money shot) ── */
const DrawerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const claim = claims.find((c) => c.claimId === recourse.drawerClaimId)!;
  const slide = interpolate(frame, [16, 34], [560, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scrim = interpolate(frame, [16, 34], [0, 0.32], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: t.bg, fontFamily: t.sans, color: t.ink }}>
      <div style={{ maxWidth: 1640, margin: "0 auto", padding: "44px 70px", width: "100%" }}>
        <Masthead />
        <Stepper step={3} />
        <div style={{ fontSize: 26, fontWeight: 650, marginBottom: 14 }}>Click any underlined line → see the exact law it came from</div>
        <VerifyBar />
        <LetterPaper activeId={claim.claimId} />
      </div>
      {/* scrim */}
      <AbsoluteFill style={{ background: `rgba(20,22,26,${scrim})` }} />
      {/* drawer */}
      <div style={{ position: "absolute", top: 0, right: 0, height: "100%", width: 600, background: t.paper, borderLeft: `1px solid ${t.line}`, boxShadow: "-8px 0 30px rgba(0,0,0,0.18)", padding: "40px 40px", transform: `translateX(${slide}px)`, fontFamily: t.sans }}>
        <FadeUp start={30}>
          <span style={{ display: "inline-block", background: t.greenSoft, color: t.green, fontSize: 15, fontWeight: 700, borderRadius: 6, padding: "6px 14px", marginBottom: 16 }}>✓ Verified against legislation</span>
          <div style={{ fontSize: 24, fontWeight: 700, margin: "6px 0 4px" }}>{claim.citation}</div>
          <div style={{ fontSize: 14, color: t.accent, wordBreak: "break-all", marginBottom: 18 }}>{claim.uri}</div>

          <div style={{ fontSize: 12.5, textTransform: "uppercase", letterSpacing: "0.7px", color: t.muted, margin: "18px 0 6px" }}>In your letter</div>
          <p style={{ margin: 0, padding: "12px 16px", borderLeft: `3px solid ${t.accent}`, background: t.accentSoft, fontStyle: "italic", borderRadius: "0 6px 6px 0", fontSize: 16, lineHeight: 1.55 }}>{claim.rendered}</p>

          <div style={{ fontSize: 12.5, textTransform: "uppercase", letterSpacing: "0.7px", color: t.muted, margin: "22px 0 6px" }}>Source — primary legislation</div>
          <div style={{ fontFamily: t.serif, fontSize: 16, background: t.bg, border: `1px solid ${t.line}`, borderRadius: 8, padding: "16px 18px", lineHeight: 1.65 }}>{highlightQuote(claim.sourceText, claim.quote)}</div>

          <div style={{ fontSize: 13.5, color: t.muted, marginTop: 18, lineHeight: 1.5 }}>The highlighted words are checked, character-for-character, against the cached Act. If they don't match, the letter is rejected — not shipped.</div>
        </FadeUp>
      </div>
    </AbsoluteFill>
  );
};

/* ── Scene 6 — Outro ── */
const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: t.bg, fontFamily: t.sans, color: t.ink, justifyContent: "center", alignItems: "center", opacity: o, padding: 100 }}>
      <div style={{ textAlign: "center", maxWidth: 1100 }}>
        <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-0.5px" }}>{recourse.brand.product}</div>
        <div style={{ fontSize: 28, color: t.muted, margin: "18px 0 34px", lineHeight: 1.45 }}>No hallucinated law. Every sentence in the letter, traceable to the Act.</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          {["Verified against legislation", "Deterministic engines", "Court-ready Letter Before Claim"].map((p) => (
            <span key={p} style={{ background: t.greenSoft, color: t.green, border: "1px solid #bfe3cd", borderRadius: 999, padding: "8px 16px", fontSize: 16, fontWeight: 600 }}>{p}</span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const recourseCaptions: Caption[] = [
  { from: 8, durationInFrames: 78, text: "Recourse turns a deposit dispute into a court-ready letter — without a lawyer." },
  { from: 96, durationInFrames: 140, text: "Jamie just drops in his tenancy papers. Recourse reads them and fills in the facts." },
  { from: 246, durationInFrames: 200, text: "The penalty, the deadlines, the limits — all computed in code, never guessed by the AI." },
  { from: 456, durationInFrames: 260, text: "It drafts a Letter Before Claim where every legal sentence is checked against the law." },
  { from: 726, durationInFrames: 288, text: "Tap any underlined line — and see the exact words of the Housing Act it came from, highlighted." },
  { from: 1026, durationInFrames: 80, text: "No hallucinated law. Every sentence, traceable to the Act." },
];

const Scenes: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={90}><TitleScene /></Sequence>
    <Sequence from={90} durationInFrames={150}><UploadScene /></Sequence>
    <Sequence from={240} durationInFrames={210}><AssessmentScene /></Sequence>
    <Sequence from={450} durationInFrames={270}><LetterScene /></Sequence>
    <Sequence from={720} durationInFrames={300}><DrawerScene /></Sequence>
    <Sequence from={1020} durationInFrames={90}><OutroScene /></Sequence>
  </AbsoluteFill>
);

export const RecourseDemo: React.FC = () => (
  <AbsoluteFill>
    <Scenes />
    <CaptionTrack captions={recourseCaptions} />
  </AbsoluteFill>
);
