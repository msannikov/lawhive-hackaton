import type { CaseAssessment } from "../types";
import EscalationBanner from "./EscalationBanner";
import NegotiationPanel, { type NegotiationApi } from "./NegotiationPanel";
import NextMove from "./NextMove";
import ReasoningTrace from "./ReasoningTrace";
import Toolset from "./Toolset";
import Timeline from "./Timeline";

interface Props {
  assessment: CaseAssessment;
  neg: NegotiationApi;
  onOpenTool: (id: string) => void;
}

export default function Assessment({ assessment, neg, onOpenTool }: Props) {
  return (
    <section className="assessment">
      <div className="assessment-head">
        <span className="branch-pill">{assessment.branchLabel}</span>
        <p className="assessment-summary">{assessment.summary}</p>
      </div>

      <EscalationBanner escalation={assessment.escalation} />

      <NegotiationPanel neg={neg} />

      <div className="assessment-grid">
        <div className="assessment-main">
          {assessment.nextMove && <NextMove nextMove={assessment.nextMove} onOpenTool={onOpenTool} />}

          <h3 className="block-title">Your toolkit</h3>
          <p className="block-sub">Each step has a concrete action and a date it's due — open one to act on it.</p>
          <Toolset tools={assessment.tools} onOpenTool={onOpenTool} />

          <ReasoningTrace reasoning={assessment.reasoning} />
        </div>

        <aside className="assessment-side">
          <Timeline assessment={assessment} onOpenTool={onOpenTool} />
        </aside>
      </div>
    </section>
  );
}
