import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import assessmentData from "./data/assessment.json";
import { FadeIn, Panel, Pill, StepBadge } from "./components/ui";
import { escalationColor, formatDeadline, theme } from "./theme";
import type { DemoAssessment, DemoNegotiationRound } from "./types";

const data = assessmentData as DemoAssessment;

const evidenceLabels: Record<string, string> = {
  "deposit.amount": "Deposit amount",
  "deposit.paidDate": "Date landlord received deposit",
  "protection.prescribedInformationGiven": "Prescribed information given?",
  "protection.schemeSearches": "Scheme register searches",
};

const formatEvidenceValue = (field: string, value: unknown) => {
  if (field === "deposit.amount" && typeof value === "number") return `£${value.toFixed(2)}`;
  if (field === "deposit.paidDate" && typeof value === "string") {
    return new Date(value).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return JSON.stringify(value);
};

const BrandMark: React.FC<{ large?: boolean }> = ({ large = false }) => (
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
      <div
        style={{
          fontFamily: theme.font,
          fontWeight: 800,
          fontSize: large ? 34 : 22,
          color: theme.text,
          lineHeight: 1,
        }}
      >
        {data.brand.product}
      </div>
      {!large ? (
        <div style={{ fontSize: 14, color: theme.muted, marginTop: 2 }}>{data.brand.title}</div>
      ) : null}
    </div>
  </div>
);

const SceneHeader: React.FC = () => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
    <BrandMark />
    <Pill text={data.caseMeta.depositFormatted} color={theme.warning} />
  </div>
);

const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const subtitleOpacity = interpolate(frame, [25, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const caseOpacity = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
        <h1 style={{ fontSize: 84, margin: "0 0 20px", lineHeight: 1.02, fontWeight: 800 }}>
          {data.brand.title}
        </h1>
        <p style={{ fontSize: 30, color: theme.muted, opacity: subtitleOpacity, margin: "0 0 32px", lineHeight: 1.45 }}>
          {data.brand.subtitle}
        </p>
        <div
          style={{
            opacity: caseOpacity,
            display: "inline-grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
            textAlign: "left",
          }}
        >
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

const PipelineBar: React.FC<{ activeStep: number }> = ({ activeStep }) => (
  <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
    {data.workflowSteps.map((step, i) => {
      const active = i <= activeStep;
      return (
        <div key={step.id} style={{ flex: 1 }}>
          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: active ? theme.pipeline[i] : theme.panelBorder,
              marginBottom: 10,
            }}
          />
          <div style={{ fontSize: 16, color: active ? theme.text : theme.muted, fontWeight: 600 }}>
            {step.label}
          </div>
          <div style={{ fontSize: 13, color: theme.muted, marginTop: 4, lineHeight: 1.35 }}>{step.detail}</div>
        </div>
      );
    })}
  </div>
);

const DocumentsScene: React.FC = () => (
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

const ExtractionScene: React.FC = () => (
  <AbsoluteFill style={{ background: theme.bg, padding: 80, fontFamily: theme.font, color: theme.text }}>
    <SceneHeader />
    <PipelineBar activeStep={1} />
    <StepBadge index={2} label="Law Gun reads the tenancy papers" active />
    <FadeIn start={8} style={{ marginTop: 24 }}>
      <Panel title="What we extracted — with provenance">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.extraction.evidence.map((ev, i) => (
            <FadeIn key={ev.field} start={12 + i * 8} delay={0}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "260px 180px 1fr",
                  gap: 16,
                  padding: "14px 16px",
                  borderRadius: 10,
                  background: theme.bg,
                  border: `1px solid ${theme.panelBorder}`,
                  fontSize: 18,
                }}
              >
                <span style={{ fontWeight: 600 }}>{evidenceLabels[ev.field] ?? ev.field}</span>
                <span style={{ color: theme.accent, fontWeight: 700 }}>
                  {formatEvidenceValue(ev.field, ev.value)}
                </span>
                <span style={{ color: theme.muted, fontSize: 16 }}>{ev.source}</span>
              </div>
            </FadeIn>
          ))}
        </div>
        <p style={{ marginTop: 18, color: theme.muted, fontSize: 18, lineHeight: 1.5 }}>
          No form-filling — the tenant just drops PDFs and screenshots. Law Gun pulls the facts that matter
          for deposit protection law.
        </p>
      </Panel>
    </FadeIn>
  </AbsoluteFill>
);

const DecisionScene: React.FC = () => (
  <AbsoluteFill style={{ background: theme.bg, padding: 80, fontFamily: theme.font, color: theme.text }}>
    <SceneHeader />
    <PipelineBar activeStep={3} />
    <StepBadge index={3} label="Unprotected deposit → s214 court route" active />
    <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.55fr 0.4fr", gap: 20, marginTop: 24 }}>
      <FadeIn start={8}>
        <Panel title="Why this branch?">
          {data.reasoning.map((line, i) => (
            <FadeIn key={line} start={14 + i * 10}>
              <div style={{ fontSize: 20, lineHeight: 1.55, marginBottom: 12, color: theme.muted }}>
                • {line}
              </div>
            </FadeIn>
          ))}
        </Panel>
      </FadeIn>
      <FadeIn start={20}>
        <Panel title="Legal outcome">
          <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 14, lineHeight: 1.25 }}>
            {data.branchLabel}
          </div>
          <Pill text="Housing Act 2004 s214" color={theme.danger} />
          <div style={{ marginTop: 22 }}>
            <div
              style={{
                fontSize: 14,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: theme.muted,
                marginBottom: 8,
              }}
            >
              For now
            </div>
            <div style={{ fontSize: 22, color: escalationColor(data.escalation.level), fontWeight: 700 }}>
              {data.escalation.level.replace("_", " ").toUpperCase()}
            </div>
            <p style={{ fontSize: 17, color: theme.muted, lineHeight: 1.5 }}>{data.escalation.reason}</p>
          </div>
        </Panel>
      </FadeIn>
      <FadeIn start={28}>
        <Panel title="Key dates">
          {Object.entries(data.keyDates).map(([label, date]) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: theme.muted }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{date}</div>
            </div>
          ))}
        </Panel>
      </FadeIn>
    </div>
  </AbsoluteFill>
);

const ToolsetScene: React.FC = () => {
  const frame = useCurrentFrame();
  const visibleTools = Math.min(
    data.tools.length,
    Math.floor(
      interpolate(frame, [0, 120], [1, data.tools.length + 0.99], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );

  return (
    <AbsoluteFill style={{ background: theme.bg, padding: 80, fontFamily: theme.font, color: theme.text }}>
      <SceneHeader />
      <PipelineBar activeStep={3} />
      <StepBadge
        index={4}
        label={`Your deposit action plan — ${data.tools.length} steps to ${data.caseMeta.depositFormatted} back`}
        active
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, marginTop: 24 }}>
        <Panel title="Dated tools — verify, evidence, Letter Before Action, court">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {data.tools.slice(0, visibleTools).map((tool) => (
              <div
                key={tool.id}
                style={{
                  padding: 18,
                  borderRadius: 12,
                  background: theme.bg,
                  border: `1px solid ${theme.panelBorder}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
                  <div style={{ fontSize: 21, fontWeight: 700 }}>
                    [{tool.priority}] {tool.title}
                  </div>
                  <Pill text={tool.category} color={theme.pipeline[(tool.priority - 1) % 4] ?? theme.accent} />
                </div>
                <div style={{ fontSize: 16, color: theme.muted, lineHeight: 1.45 }}>{tool.nextAction}</div>
                <div style={{ marginTop: 10, fontSize: 15, color: theme.accent }}>
                  By {formatDeadline(tool.deadline)} — {tool.deadlineBasis}
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <FadeIn start={30}>
          <Panel title="Do this first">
            {data.nextMove ? (
              <>
                <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>{data.nextMove.title}</div>
                <p style={{ fontSize: 17, color: theme.muted, lineHeight: 1.5 }}>{data.nextMove.rationale}</p>
                <div style={{ marginTop: 16, fontSize: 17, color: theme.success }}>
                  Deadline: {formatDeadline(data.nextMove.deadline)}
                </div>
                <div style={{ marginTop: 20, padding: 14, borderRadius: 10, background: theme.bg }}>
                  <div style={{ fontSize: 13, color: theme.muted, marginBottom: 6 }}>Potential recovery</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>
                    {data.caseMeta.depositFormatted} deposit + 1–3× penalty
                  </div>
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
  const frame = useCurrentFrame();
  const letter = data.letterTemplate;
  const visibleChars = Math.floor(
    interpolate(frame, [8, 110], [0, letter.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const preview = letter.slice(0, visibleChars);
  const highlightOpacity = interpolate(frame, [90, 110], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: theme.bg, padding: 80, fontFamily: theme.font, color: theme.text }}>
      <SceneHeader />
      <StepBadge index={5} label="Law Gun drafts your calibrated Letter Before Action" active />
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
              <div style={{ opacity: highlightOpacity, color: highlightOpacity > 0.5 ? theme.text : theme.muted }}>
                <strong>Label</strong> — names the unprotected deposit
              </div>
              <div style={{ opacity: highlightOpacity, color: highlightOpacity > 0.5 ? theme.text : theme.muted }}>
                <strong>Calibrated questions</strong> — landlord must reply
              </div>
              <div style={{ opacity: highlightOpacity, color: highlightOpacity > 0.5 ? theme.text : theme.muted }}>
                <strong>Deadline</strong> — concrete date to return {data.caseMeta.depositFormatted}
              </div>
              <div style={{ opacity: highlightOpacity, color: highlightOpacity > 0.5 ? theme.text : theme.muted }}>
                <strong>Consequences</strong> — s214 penalty stated, court as last resort
              </div>
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

const RoundCard: React.FC<{ round: DemoNegotiationRound; compact?: boolean }> = ({ round, compact = false }) => {
  if (round.kind === "court_filing" && round.courtFiling) {
    return <CourtFilingCard round={round} compact={compact} />;
  }
  if (!round.escalation) return null;

  return (
    <Panel
      title={round.label}
      style={{
        borderColor: round.escalation.recommend ? theme.danger : theme.panelBorder,
        padding: compact ? 20 : 28,
      }}
    >
      <div style={{ fontSize: compact ? 14 : 16, color: theme.muted, marginBottom: 12, lineHeight: 1.45 }}>
        {round.userReport}
      </div>
      <div style={{ fontSize: 12, color: theme.muted, marginBottom: 6 }}>context.stage = {round.stage}</div>
      {round.escalation.recommend ? (
        <div style={{ marginBottom: 10 }}>
          <Pill text="SEE A LAWYER NOW" color={theme.danger} />
        </div>
      ) : null}
      <div style={{ fontSize: 13, color: theme.muted, marginBottom: 6 }}>Escalation</div>
      <div
        style={{
          fontSize: compact ? 20 : 24,
          fontWeight: 700,
          color: escalationColor(round.escalation.level),
          marginBottom: 10,
        }}
      >
        {round.escalation.level.replace("_", " ").toUpperCase()}
      </div>
      <p style={{ fontSize: compact ? 14 : 15, color: theme.muted, lineHeight: 1.45, marginBottom: 12 }}>
        {round.escalation.reason}
      </p>
      {round.nextMove ? (
        <>
          <div style={{ fontSize: 13, color: theme.muted, marginBottom: 4 }}>Next move</div>
          <div style={{ fontSize: compact ? 17 : 19, fontWeight: 700 }}>{round.nextMove.title}</div>
          <div
            style={{
              fontSize: 14,
              color: round.escalation.recommend ? theme.danger : theme.accent,
              marginTop: 6,
            }}
          >
            {round.nextMove.toolId === "lawyer-handoff"
              ? "before County Court filing"
              : `by ${formatDeadline(round.nextMove.deadline)}`}
          </div>
          <p style={{ fontSize: 13, color: theme.muted, marginTop: 8, lineHeight: 1.4 }}>{round.nextMove.rationale}</p>
        </>
      ) : null}
    </Panel>
  );
};

const CourtFilingCard: React.FC<{ round: DemoNegotiationRound; compact?: boolean }> = ({ round, compact = false }) => {
  const filing = round.courtFiling!;

  return (
    <Panel
      title={round.label}
      style={{
        borderColor: theme.success,
        padding: compact ? 20 : 28,
      }}
    >
      <div style={{ fontSize: compact ? 14 : 16, color: theme.muted, marginBottom: 12, lineHeight: 1.45 }}>
        {round.userReport}
      </div>
      <div style={{ marginBottom: 12 }}>
        <Pill text="County Court claim" color={theme.success} />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div style={{ padding: 12, borderRadius: 10, background: theme.bg }}>
          <div style={{ fontSize: 12, color: theme.muted }}>Deposit</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{filing.deposit}</div>
        </div>
        <div style={{ padding: 12, borderRadius: 10, background: theme.bg }}>
          <div style={{ fontSize: 12, color: theme.muted }}>s214 penalty (1–3×)</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: theme.warning }}>
            {filing.penaltyLow} – {filing.penaltyHigh}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: theme.muted, marginBottom: 8 }}>Evidence bundle</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {filing.checklist.map((item) => (
          <div key={item} style={{ fontSize: compact ? 13 : 14, color: theme.text }}>
            ✓ {item}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 13, color: theme.muted, marginBottom: 4 }}>File before</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: theme.accent }}>{filing.limitationLongstop}</div>
      <p style={{ fontSize: 13, color: theme.muted, marginTop: 10, lineHeight: 1.4 }}>{filing.nextAction}</p>
    </Panel>
  );
};

const NegotiationScene: React.FC = () => {
  const frame = useCurrentFrame();
  const round2Opacity = interpolate(frame, [40, 65], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const round3Opacity = interpolate(frame, [80, 105], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const [round1, round2, round3] = data.negotiationRounds;

  return (
    <AbsoluteFill style={{ background: theme.bg, padding: "64px 72px", fontFamily: theme.font, color: theme.text }}>
      <SceneHeader />
      <StepBadge index={6} label="Negotiation loop — 3 rounds, stateless re-assessment" active />
      <FadeIn start={4} style={{ marginTop: 16, marginBottom: 20 }}>
        <Panel style={{ padding: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              fontSize: 16,
              color: theme.muted,
              flexWrap: "wrap",
            }}
          >
            <Pill text="evaluateCase()" />
            <span>→ act → report back</span>
            <Pill text="initial" />
            <span>→</span>
            <Pill text="post_letter" />
            <span>→</span>
            <Pill text="file claim" color={theme.success} />
            <span>→</span>
            <Pill text="re-run" color={theme.success} />
          </div>
        </Panel>
      </FadeIn>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
        {round1 ? (
          <FadeIn start={8}>
            <RoundCard round={round1} compact />
          </FadeIn>
        ) : null}
        {round2 ? (
          <div style={{ opacity: round2Opacity }}>
            <RoundCard round={round2} compact />
          </div>
        ) : null}
        {round3 ? (
          <div style={{ opacity: round3Opacity }}>
            <RoundCard round={round3} compact />
          </div>
        ) : null}
      </div>
      <FadeIn start={115} style={{ marginTop: 18 }}>
        <p style={{ textAlign: "center", fontSize: 19, color: theme.muted }}>
          Round 1: self-serve. Round 2: silent landlord → lawyer handoff. Round 3: s214 County Court filing pack.
        </p>
      </FadeIn>
    </AbsoluteFill>
  );
};

const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: theme.bg,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: theme.font,
        color: theme.text,
        opacity,
        padding: 80,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 980 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <BrandMark large />
        </div>
        <h2 style={{ fontSize: 58, marginBottom: 16, lineHeight: 1.1 }}>{data.brand.title}</h2>
        <p style={{ fontSize: 28, color: theme.muted, lineHeight: 1.5 }}>
          Read the docs, draft the letter, re-assess when the landlord responds — {data.caseMeta.depositFormatted}{" "}
          back with every deadline spelled out.
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

export const WorkflowDemo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={90}>
        <TitleScene />
      </Sequence>
      <Sequence from={90} durationInFrames={120}>
        <DocumentsScene />
      </Sequence>
      <Sequence from={210} durationInFrames={150}>
        <ExtractionScene />
      </Sequence>
      <Sequence from={360} durationInFrames={150}>
        <DecisionScene />
      </Sequence>
      <Sequence from={510} durationInFrames={210}>
        <ToolsetScene />
      </Sequence>
      <Sequence from={720} durationInFrames={180}>
        <LetterScene />
      </Sequence>
      <Sequence from={900} durationInFrames={240}>
        <NegotiationScene />
      </Sequence>
      <Sequence from={1140} durationInFrames={90}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};
