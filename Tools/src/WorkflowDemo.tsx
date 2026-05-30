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
import type { DemoAssessment } from "./types";

const data = assessmentData as DemoAssessment;

const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const subtitleOpacity = interpolate(frame, [25, 45], [0, 1], {
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
      }}
    >
      <div style={{ transform: `scale(${scale})`, textAlign: "center", maxWidth: 1200 }}>
        <Pill text="Lawhive hackathon demo" />
        <h1 style={{ fontSize: 78, margin: "28px 0 16px", lineHeight: 1.05, fontWeight: 800 }}>
          Document-driven legal toolset
        </h1>
        <p style={{ fontSize: 32, color: theme.muted, opacity: subtitleOpacity, margin: 0 }}>
          Unstructured docs → VLM extraction → deterministic rules → actionable tools
        </p>
      </div>
    </AbsoluteFill>
  );
};

const PipelineBar: React.FC<{ activeStep: number }> = ({ activeStep }) => (
  <div style={{ display: "flex", gap: 12, marginBottom: 36 }}>
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
        </div>
      );
    })}
  </div>
);

const DocumentsScene: React.FC = () => (
  <AbsoluteFill style={{ background: theme.bg, padding: 80, fontFamily: theme.font, color: theme.text }}>
    <PipelineBar activeStep={0} />
    <StepBadge index={1} label="Tenant uploads documents" active />
    <FadeIn start={10} style={{ marginTop: 28 }}>
      <Panel title="Case input">
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
              <span style={{ fontSize: 20 }}>{doc.name}</span>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 20, color: theme.muted, fontSize: 22, lineHeight: 1.5 }}>
          Playbook: <strong style={{ color: theme.text }}>{data.domain}</strong> — no structured form,
          just raw files.
        </p>
      </Panel>
    </FadeIn>
  </AbsoluteFill>
);

const ExtractionScene: React.FC = () => (
  <AbsoluteFill style={{ background: theme.bg, padding: 80, fontFamily: theme.font, color: theme.text }}>
    <PipelineBar activeStep={1} />
    <StepBadge index={2} label="VLM extracts facts" active />
    <FadeIn start={8} style={{ marginTop: 24 }}>
      <Panel title={`Provider: ${data.extraction.provider}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.extraction.evidence.slice(0, 6).map((ev, i) => (
            <FadeIn key={ev.field} start={12 + i * 8} delay={0}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "280px 1fr 320px",
                  gap: 16,
                  padding: "14px 16px",
                  borderRadius: 10,
                  background: theme.bg,
                  border: `1px solid ${theme.panelBorder}`,
                  fontSize: 18,
                }}
              >
                <code style={{ fontFamily: theme.mono, color: theme.accent }}>{ev.field}</code>
                <span>{JSON.stringify(ev.value)}</span>
                <span style={{ color: theme.muted, fontSize: 16 }}>{ev.source}</span>
              </div>
            </FadeIn>
          ))}
        </div>
      </Panel>
    </FadeIn>
  </AbsoluteFill>
);

const DecisionScene: React.FC = () => (
  <AbsoluteFill style={{ background: theme.bg, padding: 80, fontFamily: theme.font, color: theme.text }}>
    <PipelineBar activeStep={3} />
    <StepBadge index={3} label="Rules engine matches branch" active />
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 24, marginTop: 24 }}>
      <FadeIn start={8}>
        <Panel title="Decision trace">
          {data.reasoning.map((line, i) => (
            <FadeIn key={line} start={14 + i * 10}>
              <div style={{ fontSize: 21, lineHeight: 1.55, marginBottom: 12, color: theme.muted }}>
                • {line}
              </div>
            </FadeIn>
          ))}
        </Panel>
      </FadeIn>
      <FadeIn start={20}>
        <Panel title="Assessment">
          <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>{data.branchLabel}</div>
          <Pill text={data.branch} />
          <div style={{ marginTop: 24 }}>
            <div
              style={{
                fontSize: 16,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: theme.muted,
                marginBottom: 8,
              }}
            >
              Escalation
            </div>
            <div style={{ fontSize: 24, color: escalationColor(data.escalation.level), fontWeight: 700 }}>
              {data.escalation.level.replace("_", " ").toUpperCase()}
            </div>
            <p style={{ fontSize: 18, color: theme.muted, lineHeight: 1.5 }}>{data.escalation.reason}</p>
          </div>
        </Panel>
      </FadeIn>
    </div>
  </AbsoluteFill>
);

const ToolsetScene: React.FC = () => {
  const frame = useCurrentFrame();
  const visibleTools = Math.min(
    data.tools.length,
    Math.floor(interpolate(frame, [0, 120], [1, data.tools.length + 0.99], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })),
  );

  return (
    <AbsoluteFill style={{ background: theme.bg, padding: 80, fontFamily: theme.font, color: theme.text }}>
      <PipelineBar activeStep={3} />
      <StepBadge index={4} label="Toolset with deadlines" active />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, marginTop: 24 }}>
        <Panel title="Arsenal">
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
                  <div style={{ fontSize: 22, fontWeight: 700 }}>
                    [{tool.priority}] {tool.title}
                  </div>
                  <Pill text={tool.category} color={theme.pipeline[(tool.priority - 1) % 4] ?? theme.accent} />
                </div>
                <div style={{ fontSize: 17, color: theme.muted, lineHeight: 1.45 }}>{tool.nextAction}</div>
                <div style={{ marginTop: 10, fontSize: 16, color: theme.accent }}>
                  By {formatDeadline(tool.deadline)} — {tool.deadlineBasis}
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <FadeIn start={30}>
          <Panel title="Next move">
            {data.nextMove ? (
              <>
                <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>{data.nextMove.title}</div>
                <p style={{ fontSize: 18, color: theme.muted, lineHeight: 1.5 }}>{data.nextMove.rationale}</p>
                <div style={{ marginTop: 16, fontSize: 18, color: theme.success }}>
                  Deadline: {formatDeadline(data.nextMove.deadline)}
                </div>
              </>
            ) : null}
          </Panel>
        </FadeIn>
      </div>
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
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 980 }}>
        <h2 style={{ fontSize: 56, marginBottom: 16 }}>Auditable core, AI at the edges</h2>
        <p style={{ fontSize: 28, color: theme.muted, lineHeight: 1.5 }}>
          VLM extraction is pluggable. Branch matching and tool deadlines are deterministic — new domains
          are just new playbooks.
        </p>
        <div style={{ marginTop: 36, display: "flex", justifyContent: "center", gap: 12 }}>
          <Pill text="evaluateCase()" />
          <Pill text="playbook.assess()" />
          <Pill text="MockProvider offline" />
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
      <Sequence from={510} durationInFrames={270}>
        <ToolsetScene />
      </Sequence>
      <Sequence from={780} durationInFrames={120}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};
