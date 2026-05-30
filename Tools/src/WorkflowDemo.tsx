import { createContext, useContext } from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import mockData from "./data/assessment.json";
import claudeData from "./data/assessment.claude.json";
import { FadeIn, Panel, Pill, StepBadge } from "./components/ui";
import { CaptionTrack, demoCaptions, type Caption } from "./components/captions";
import { escalationColor, formatDeadline, theme } from "./theme";
import type { DemoAssessment, DemoNegotiationRound } from "./types";

/** Demo data is injected per-composition (mock vs Claude) via context. */
const DemoContext = createContext<DemoAssessment>(mockData as DemoAssessment);
const useDemo = () => useContext(DemoContext);

const evidenceLabels: Record<string, string> = {
  "deposit.amount": "Deposit amount",
  "deposit.paidDate": "Date landlord received deposit",
  "protection.prescribedInformationGiven": "Prescribed information given?",
  "protection.schemeSearches": "Scheme register searches",
  "protection.protectedInScheme": "Protected in a scheme?",
  "tenant.name": "Tenant",
  "landlord.name": "Landlord",
  "property.address": "Property",
};

const formatEvidenceValue = (field: string, value: unknown) => {
  if (field === "deposit.amount" && typeof value === "number") return `£${value.toFixed(2)}`;
  if (field === "deposit.paidDate" && typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    }
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
};

const BrandMark: React.FC<{ large?: boolean }> = ({ large = false }) => {
  const data = useDemo();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: large ? 16 : 10 }}>
      <div
        style={{
          width: large ? 52 : 36,
          height: large ? 52 : 36,
          borderRadius: 12,
          background: `linear-gradient(135deg, ${theme.accent}, #6366f1)`,
          display: "grid",
          placeItems: "center",
          fontFamily: theme.font,
          fontWeight: 900,
          fontSize: large ? 22 : 15,
          color: theme.bg,
        }}
      >
        LG
      </div>
      <div>
        <div style={{ fontFamily: theme.font, fontWeight: 800, fontSize: large ? 34 : 22, color: theme.text, lineHeight: 1 }}>
          {data.brand.product}
        </div>
        {!large ? <div style={{ fontSize: 14, color: theme.muted, marginTop: 2 }}>{data.brand.title}</div> : null}
      </div>
    </div>
  );
};

const ProviderBadge: React.FC = () => {
  const data = useDemo();
  const live = data.extraction.provider !== "mock";
  return (
    <Pill
      text={live ? `live: ${data.extraction.provider}` : "offline: mock"}
      color={live ? theme.success : theme.muted}
    />
  );
};

const SceneHeader: React.FC = () => {
  const data = useDemo();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
      <BrandMark />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <ProviderBadge />
        <Pill text={data.caseMeta.depositFormatted} color={theme.warning} />
      </div>
    </div>
  );
};

const TitleScene: React.FC = () => {
  const data = useDemo();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const subtitleOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const caseOpacity = interpolate(frame, [40, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 20% 20%, ${theme.accentSoft}, transparent 45%), ${theme.bg}`,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: theme.font,
        color: theme.text,
        padding: 80,
      }}
    >
      <div style={{ transform: `scale(${scale})`, textAlign: "center", maxWidth: 1180 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <BrandMark large />
        </div>
        <h1 style={{ fontSize: 84, margin: "0 0 20px", lineHeight: 1.02, fontWeight: 800 }}>{data.brand.title}</h1>
        <p style={{ fontSize: 30, color: theme.muted, opacity: subtitleOpacity, margin: "0 0 32px", lineHeight: 1.45 }}>
          {data.brand.subtitle}
        </p>
        <div style={{ opacity: caseOpacity, display: "inline-grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, textAlign: "left" }}>
          <Panel style={{ padding: 20 }}>
            <div style={{ fontSize: 14, color: theme.muted, marginBottom: 6 }}>Tenant</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{data.caseMeta.tenantName}</div>
          </Panel>
          <Panel style={{ padding: 20 }}>
            <div style={{ fontSize: 14, color: theme.muted, marginBottom: 6 }}>Deposit at stake</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: theme.warning }}>{data.caseMeta.depositFormatted}</div>
          </Panel>
          <Panel style={{ padding: 20 }}>
            <div style={{ fontSize: 14, color: theme.muted, marginBottom: 6 }}>Problem found</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: theme.danger }}>{data.caseMeta.problem}</div>
          </Panel>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const PipelineBar: React.FC<{ activeStep: number }> = ({ activeStep }) => {
  const data = useDemo();
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
      {data.workflowSteps.map((step, i) => {
        const active = i <= activeStep;
        return (
          <div key={step.id} style={{ flex: 1 }}>
            <div style={{ height: 6, borderRadius: 999, background: active ? theme.pipeline[i] : theme.panelBorder, marginBottom: 10 }} />
            <div style={{ fontSize: 16, color: active ? theme.text : theme.muted, fontWeight: 600 }}>{step.label}</div>
            <div style={{ fontSize: 13, color: theme.muted, marginTop: 4, lineHeight: 1.35 }}>{step.detail}</div>
          </div>
        );
      })}
    </div>
  );
};

const DocumentsScene: React.FC = () => {
  const data = useDemo();
  return (
    <AbsoluteFill style={{ background: theme.bg, padding: 80, fontFamily: theme.font, color: theme.text }}>
      <SceneHeader />
      <PipelineBar activeStep={0} />
      <StepBadge index={1} label="Jamie uploads his deposit evidence" active />
      <FadeIn start={10} style={{ marginTop: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 24 }}>
          <Panel title="Files from the tenant">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {data.documents.map((doc) => (
                <div
                  key={doc.name}
                  style={{
                    padding: 18,
                    borderRadius: 12,
                    background: theme.bg,
                    border: `1px solid ${theme.panelBorder}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: doc.kind === "pdf" ? "#ef444433" : "#22c55e33",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      color: doc.kind === "pdf" ? "#fca5a5" : theme.success,
                    }}
                  >
                    {doc.kind.toUpperCase()}
                  </div>
                  <span style={{ fontSize: 18 }}>{doc.name}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="The question">
            <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.35, marginBottom: 18 }}>
              "My tenancy ended — why hasn't my {data.caseMeta.depositFormatted} deposit come back?"
            </div>
            <div style={{ fontSize: 17, color: theme.muted, lineHeight: 1.5 }}>
              <div>{data.caseMeta.propertyAddress}</div>
              <div style={{ marginTop: 10 }}>Landlord: {data.caseMeta.landlordName}</div>
            </div>
            <div style={{ marginTop: 18 }}>
              <Pill text={data.caseMeta.playbookLabel} />
            </div>
          </Panel>
        </div>
      </FadeIn>
    </AbsoluteFill>
  );
};

// Surface the legally-interesting facts first (Claude often lists names first).
const evidencePriority = [
  "deposit.amount",
  "deposit.paidDate",
  "protection.protectedInScheme",
  "protection.schemeSearches",
  "protection.prescribedInformationGiven",
  "tenancy.startDate",
  "tenancy.endDate",
];
const evidenceRank = (field: string) => {
  const i = evidencePriority.indexOf(field);
  return i === -1 ? evidencePriority.length + 1 : i;
};

const ExtractionScene: React.FC = () => {
  const data = useDemo();
  const evidence = [...data.extraction.evidence]
    .sort((a, b) => evidenceRank(a.field) - evidenceRank(b.field))
    .slice(0, 6);
  return (
    <AbsoluteFill style={{ background: theme.bg, padding: 80, fontFamily: theme.font, color: theme.text }}>
      <SceneHeader />
      <PipelineBar activeStep={1} />
      <StepBadge index={2} label="Law Gun reads the tenancy papers" active />
      <FadeIn start={8} style={{ marginTop: 24 }}>
        <Panel title="What we extracted — with provenance">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {evidence.map((ev, i) => (
              <FadeIn key={ev.field + i} start={12 + i * 8} delay={0}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "300px 200px 1fr",
                    gap: 16,
                    padding: "14px 16px",
                    borderRadius: 10,
                    background: theme.bg,
                    border: `1px solid ${theme.panelBorder}`,
                    fontSize: 18,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{evidenceLabels[ev.field] ?? ev.field}</span>
                  <span style={{ color: theme.accent, fontWeight: 700 }}>{formatEvidenceValue(ev.field, ev.value)}</span>
                  <span style={{ color: theme.muted, fontSize: 16 }}>{ev.source}</span>
                </div>
              </FadeIn>
            ))}
          </div>
          <p style={{ marginTop: 18, color: theme.muted, fontSize: 18, lineHeight: 1.5 }}>
            No form-filling — the tenant just drops PDFs and screenshots. Law Gun pulls the facts that matter for
            deposit protection law.
          </p>
        </Panel>
      </FadeIn>
    </AbsoluteFill>
  );
};

const ChannelsScene: React.FC = () => {
  const data = useDemo();
  const ch = data.channels;
  const color = escalationColor(ch.updatedStatus);
  return (
    <AbsoluteFill style={{ background: theme.bg, padding: 80, fontFamily: theme.font, color: theme.text }}>
      <SceneHeader />
      <StepBadge index={5} label="However your landlord replies, Law Gun reads it" active />
      <FadeIn start={6} style={{ marginTop: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, color: theme.muted }}>Forward it from anywhere:</span>
          {ch.supported.map((c) => (
            <Pill key={c} text={c} color={theme.accent} />
          ))}
        </div>
      </FadeIn>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <FadeIn start={12}>
          <Panel title="Your landlord got back to you">
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <div style={{ maxWidth: "75%", background: "#005c4b", color: "#e9fdf6", borderRadius: "14px 14px 4px 14px", padding: "12px 16px", fontSize: 16 }}>
                Letter Before Action — sent ✓
              </div>
            </div>
            <FadeIn start={30}>
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ maxWidth: "85%", background: "#202c33", borderRadius: "14px 14px 14px 4px", padding: 18 }}>
                  <div style={{ fontSize: 13, color: theme.success, marginBottom: 8, fontFamily: theme.mono }}>
                    {ch.inbound.channel} · {ch.inbound.from} · {ch.inbound.time}
                  </div>
                  <div style={{ fontSize: 19, lineHeight: 1.55 }}>{ch.inbound.text}</div>
                </div>
              </div>
            </FadeIn>
          </Panel>
        </FadeIn>
        <FadeIn start={40}>
          <Panel title="Law Gun read the reply">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {ch.reading.map((r, i) => (
                <FadeIn key={r} start={48 + i * 10}>
                  <div style={{ fontSize: 18, lineHeight: 1.5, color: theme.muted }}>• {r}</div>
                </FadeIn>
              ))}
            </div>
            <FadeIn start={90}>
              <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: `${color}14`, border: `1px solid ${color}55` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 999, background: color, display: "inline-block" }} />
                  <span style={{ fontSize: 19, fontWeight: 700, color }}>{friendlyStatus(ch.updatedStatus)}</span>
                </div>
                <div style={{ fontSize: 16, color: theme.text, lineHeight: 1.5 }}>{ch.updatedLine}</div>
              </div>
            </FadeIn>
          </Panel>
        </FadeIn>
      </div>
    </AbsoluteFill>
  );
};

const ToolsetScene: React.FC = () => {
  const data = useDemo();
  const frame = useCurrentFrame();
  const visibleTools = Math.min(
    data.tools.length,
    Math.floor(interpolate(frame, [0, 120], [1, data.tools.length + 0.99], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })),
  );

  return (
    <AbsoluteFill style={{ background: theme.bg, padding: 80, fontFamily: theme.font, color: theme.text }}>
      <SceneHeader />
      <PipelineBar activeStep={3} />
      <StepBadge index={3} label={`Your deposit action plan — ${data.tools.length} steps to ${data.caseMeta.depositFormatted} back`} active />
      <FadeIn start={4} style={{ marginTop: 14 }}>
        <div style={{ fontSize: 19, color: theme.muted, lineHeight: 1.5 }}>
          Your landlord broke the law by never protecting your deposit. You're owed your{" "}
          <span style={{ color: theme.text, fontWeight: 700 }}>{data.caseMeta.depositFormatted}</span> back — plus{" "}
          <span style={{ color: theme.warning, fontWeight: 700 }}>up to 3× more</span> as a penalty.
        </div>
      </FadeIn>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, marginTop: 20 }}>
        <Panel title="Your step-by-step plan — each one with a date">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {data.tools.slice(0, visibleTools).map((tool) => {
              const picked = data.nextMove?.toolId === tool.id;
              return (
                <div
                  key={tool.id}
                  style={{
                    padding: 18,
                    borderRadius: 12,
                    background: picked ? `${theme.accent}14` : theme.bg,
                    border: picked ? `2px solid ${theme.accent}` : `1px solid ${theme.panelBorder}`,
                    boxShadow: picked ? `0 0 0 4px ${theme.accent}22` : undefined,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 8 }}>
                    <div style={{ fontSize: 21, fontWeight: 700, display: "flex", alignItems: "center", gap: 12 }}>
                      <span>{tool.priority}. {tool.title}</span>
                      {picked ? <Pill text="START HERE" color={theme.accent} /> : null}
                    </div>
                    <Pill text={tool.category} color={theme.pipeline[(tool.priority - 1) % 4] ?? theme.accent} />
                  </div>
                  <div style={{ fontSize: 16, color: theme.muted, lineHeight: 1.45 }}>{tool.nextAction}</div>
                  <div style={{ marginTop: 10, fontSize: 15, color: theme.accent }}>
                    By {formatDeadline(tool.deadline)} — {tool.deadlineBasis}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
        <FadeIn start={30}>
          <Panel title="Do this first">
            {data.nextMove ? (
              <>
                <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>{data.nextMove.title}</div>
                <p style={{ fontSize: 17, color: theme.muted, lineHeight: 1.5 }}>{data.nextMove.rationale}</p>
                <div style={{ marginTop: 16, fontSize: 17, color: theme.success }}>Deadline: {formatDeadline(data.nextMove.deadline)}</div>
                <div style={{ marginTop: 20, padding: 14, borderRadius: 10, background: theme.bg }}>
                  <div style={{ fontSize: 13, color: theme.muted, marginBottom: 6 }}>Potential recovery</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{data.caseMeta.depositFormatted} deposit + 1–3× penalty</div>
                </div>
              </>
            ) : null}
          </Panel>
        </FadeIn>
      </div>
    </AbsoluteFill>
  );
};

const LetterScene: React.FC = () => {
  const data = useDemo();
  const frame = useCurrentFrame();
  const letter = data.letterTemplate;
  const visibleChars = Math.floor(interpolate(frame, [8, 150], [0, letter.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const preview = letter.slice(0, visibleChars);
  const highlightOpacity = interpolate(frame, [120, 145], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: theme.bg, padding: 80, fontFamily: theme.font, color: theme.text }}>
      <SceneHeader />
      <StepBadge index={4} label="Law Gun drafts your demand letter — ready to send" active />
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 24, marginTop: 24 }}>
        <FadeIn start={6}>
          <Panel title="Generated letter — ready to send">
            <div
              style={{
                background: "#fff",
                color: "#111827",
                borderRadius: 10,
                padding: 28,
                minHeight: 520,
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: 17,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                boxShadow: "inset 0 0 0 1px #e5e7eb",
              }}
            >
              {preview}
              <span style={{ opacity: frame % 20 < 10 ? 1 : 0 }}>|</span>
            </div>
          </Panel>
        </FadeIn>
        <FadeIn start={20}>
          <Panel title="Negotiation framing">
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 14, lineHeight: 1.35 }}>
              Built to get a response — not just assert a claim
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 17, color: theme.muted, lineHeight: 1.5 }}>
              {[
                ["Label", "names the unprotected deposit"],
                ["Calibrated questions", "landlord must reply"],
                ["Deadline", `concrete date to return ${data.caseMeta.depositFormatted}`],
                ["Consequences", "s214 penalty stated, court as last resort"],
              ].map(([k, v]) => (
                <div key={k} style={{ opacity: highlightOpacity, color: highlightOpacity > 0.5 ? theme.text : theme.muted }}>
                  <strong>{k}</strong> — {v}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 22 }}>
              <Pill text="documentTemplate" />
            </div>
          </Panel>
        </FadeIn>
      </div>
    </AbsoluteFill>
  );
};

const friendlyStatus = (level: string) => {
  switch (level) {
    case "self_serve":
      return "You can handle this yourself";
    case "monitor":
      return "Handle it yourself — for now";
    case "escalate":
      return "Time to bring in a lawyer";
    default:
      return "";
  }
};

const RoundCard: React.FC<{ round: DemoNegotiationRound; compact?: boolean }> = ({ round, compact = false }) => {
  if (round.kind === "court_filing" && round.courtFiling) {
    return <CourtFilingCard round={round} compact={compact} />;
  }
  if (!round.escalation) return null;
  const color = escalationColor(round.escalation.level);

  return (
    <Panel title={round.label} style={{ borderColor: round.escalation.recommend ? theme.danger : theme.panelBorder, padding: compact ? 22 : 28 }}>
      <div style={{ fontSize: compact ? 15 : 16, color: theme.text, marginBottom: 16, lineHeight: 1.45 }}>{round.userReport}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ width: 12, height: 12, borderRadius: 999, background: color, display: "inline-block" }} />
        <span style={{ fontSize: compact ? 19 : 22, fontWeight: 700, color }}>{friendlyStatus(round.escalation.level)}</span>
      </div>
      {round.escalation.recommend ? (
        <div style={{ marginBottom: 10 }}>
          <Pill text="SEE A LAWYER NOW" color={theme.danger} />
        </div>
      ) : null}
      <p style={{ fontSize: compact ? 14 : 15, color: theme.muted, lineHeight: 1.45, marginBottom: 16 }}>{round.escalation.reason}</p>
      {round.nextMove ? (
        <div style={{ borderTop: `1px solid ${theme.panelBorder}`, paddingTop: 14 }}>
          <div style={{ fontSize: 13, color: theme.muted, marginBottom: 4 }}>What to do now</div>
          <div style={{ fontSize: compact ? 17 : 19, fontWeight: 700 }}>{round.nextMove.title}</div>
          <div style={{ fontSize: 14, color: round.escalation.recommend ? theme.danger : theme.accent, marginTop: 6 }}>
            {round.nextMove.toolId === "lawyer-handoff" ? "before going to court" : `by ${formatDeadline(round.nextMove.deadline)}`}
          </div>
        </div>
      ) : null}
    </Panel>
  );
};

const CourtFilingCard: React.FC<{ round: DemoNegotiationRound; compact?: boolean }> = ({ round, compact = false }) => {
  const filing = round.courtFiling!;
  return (
    <Panel title={round.label} style={{ borderColor: theme.success, padding: compact ? 20 : 28 }}>
      <div style={{ fontSize: compact ? 14 : 16, color: theme.muted, marginBottom: 12, lineHeight: 1.45 }}>{round.userReport}</div>
      <div style={{ marginBottom: 12 }}>
        <Pill text="County Court claim" color={theme.success} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div style={{ padding: 12, borderRadius: 10, background: theme.bg }}>
          <div style={{ fontSize: 12, color: theme.muted }}>Deposit</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{filing.deposit}</div>
        </div>
        <div style={{ padding: 12, borderRadius: 10, background: theme.bg }}>
          <div style={{ fontSize: 12, color: theme.muted }}>Compensation (1–3× deposit)</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: theme.warning }}>
            {filing.penaltyLow} – {filing.penaltyHigh}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: theme.muted, marginBottom: 8 }}>Evidence bundle</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {filing.checklist.map((item) => (
          <div key={item} style={{ fontSize: compact ? 13 : 14, color: theme.text }}>✓ {item}</div>
        ))}
      </div>
      <div style={{ fontSize: 13, color: theme.muted, marginBottom: 4 }}>File before</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: theme.accent }}>{filing.limitationLongstop}</div>
      <p style={{ fontSize: 13, color: theme.muted, marginTop: 10, lineHeight: 1.4 }}>{filing.nextAction}</p>
    </Panel>
  );
};

const NegotiationScene: React.FC = () => {
  const data = useDemo();
  const frame = useCurrentFrame();
  const round2Opacity = interpolate(frame, [40, 65], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const round3Opacity = interpolate(frame, [80, 105], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const [round1, round2, round3] = data.negotiationRounds;

  return (
    <AbsoluteFill style={{ background: theme.bg, padding: "64px 72px", fontFamily: theme.font, color: theme.text }}>
      <SceneHeader />
      <StepBadge index={6} label="What happens next — we guide you round by round" active />
      <FadeIn start={4} style={{ marginTop: 16, marginBottom: 20 }}>
        <Panel style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, fontSize: 19, color: theme.muted, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, color: theme.text }}>You take the step</span>
            <span>→</span>
            <span style={{ fontWeight: 700, color: theme.text }}>tell us what happened</span>
            <span>→</span>
            <span style={{ fontWeight: 700, color: theme.text }}>your plan updates</span>
          </div>
        </Panel>
      </FadeIn>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
        {round1 ? (
          <FadeIn start={8}>
            <RoundCard round={round1} compact />
          </FadeIn>
        ) : null}
        {round2 ? <div style={{ opacity: round2Opacity }}><RoundCard round={round2} compact /></div> : null}
        {round3 ? <div style={{ opacity: round3Opacity }}><RoundCard round={round3} compact /></div> : null}
      </div>
      <FadeIn start={115} style={{ marginTop: 18 }}>
        <p style={{ textAlign: "center", fontSize: 20, color: theme.muted }}>
          Most cases end with the letter. If your landlord ignores it, Law Gun tells you exactly when to bring in a lawyer.
        </p>
      </FadeIn>
    </AbsoluteFill>
  );
};

const OutroScene: React.FC = () => {
  const data = useDemo();
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: theme.bg, justifyContent: "center", alignItems: "center", fontFamily: theme.font, color: theme.text, opacity, padding: 80 }}>
      <div style={{ textAlign: "center", maxWidth: 980 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <BrandMark large />
        </div>
        <h2 style={{ fontSize: 58, marginBottom: 16, lineHeight: 1.1 }}>{data.brand.title}</h2>
        <p style={{ fontSize: 28, color: theme.muted, lineHeight: 1.5 }}>
          Read the docs, draft the letter, re-assess when the landlord responds — {data.caseMeta.depositFormatted} back with every
          deadline spelled out.
        </p>
        <div style={{ marginTop: 36, display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <Pill text="Calibrated LBA" />
          <Pill text="Negotiation loop" color={theme.success} />
          <Pill text="MONITOR → ESCALATE" color={theme.warning} />
          <Pill text="s214 penalty" color={theme.danger} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Scenes: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={90}><TitleScene /></Sequence>
    <Sequence from={90} durationInFrames={120}><DocumentsScene /></Sequence>
    <Sequence from={210} durationInFrames={150}><ExtractionScene /></Sequence>
    <Sequence from={360} durationInFrames={210}><ToolsetScene /></Sequence>
    <Sequence from={570} durationInFrames={180}><LetterScene /></Sequence>
    <Sequence from={750} durationInFrames={210}><ChannelsScene /></Sequence>
    <Sequence from={960} durationInFrames={210}><NegotiationScene /></Sequence>
    <Sequence from={1170} durationInFrames={60}><OutroScene /></Sequence>
  </AbsoluteFill>
);

const Demo: React.FC<{ data: DemoAssessment; captions?: Caption[] }> = ({ data, captions = demoCaptions }) => (
  <DemoContext.Provider value={data}>
    <AbsoluteFill>
      <Scenes />
      <CaptionTrack captions={captions} />
    </AbsoluteFill>
  </DemoContext.Provider>
);

/** Offline (MockProvider fixture) demo. */
export const WorkflowDemo: React.FC = () => <Demo data={mockData as DemoAssessment} />;

/** Live Claude-extracted demo (reads the real documents). */
export const WorkflowDemoClaude: React.FC = () => <Demo data={claudeData as DemoAssessment} />;
