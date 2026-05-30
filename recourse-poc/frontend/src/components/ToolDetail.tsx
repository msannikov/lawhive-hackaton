import type { Tool, CaseAssessment, Facts, GroundedClaim } from "../types";
import DeadlineChip from "./DeadlineChip";
import VerifyPanel from "./toolPanels/VerifyPanel";
import LetterPanel from "./toolPanels/LetterPanel";
import EvidencePanel from "./toolPanels/EvidencePanel";
import AdrCourtPanel from "./toolPanels/AdrCourtPanel";

interface Props {
  tool: Tool;
  assessment: CaseAssessment;
  facts: Facts;
  onClaimClick: (c: GroundedClaim) => void;
  activeClaimId: string | null;
  onBack: () => void;
  onLetterSent?: () => void;
}

export default function ToolDetail({ tool, facts, onClaimClick, activeClaimId, onBack, onLetterSent }: Props) {
  return (
    <section className="tool-detail">
      <button type="button" className="back-link" onClick={onBack}>
        ← Back to your plan
      </button>
      <h2 className="section-title">{tool.title}</h2>
      <p className="tool-detail-action">{tool.nextAction}</p>

      <DeadlineChip
        date={tool.deadline}
        basis={tool.deadlineBasis}
        calendarTitle={tool.title}
        calendarDescription={tool.nextAction}
        uid={`${tool.id}-${tool.deadline}`}
      />
      {tool.legalBasis && <p className="legal-basis">Legal basis: {tool.legalBasis}</p>}

      <Panel tool={tool} facts={facts} onClaimClick={onClaimClick} activeClaimId={activeClaimId} onLetterSent={onLetterSent} />
    </section>
  );
}

function Panel({
  tool,
  facts,
  onClaimClick,
  activeClaimId,
  onLetterSent,
}: {
  tool: Tool;
  facts: Facts;
  onClaimClick: (c: GroundedClaim) => void;
  activeClaimId: string | null;
  onLetterSent?: () => void;
}) {
  switch (tool.category) {
    case "verify":
      return <VerifyPanel facts={facts} />;
    case "letter":
    case "chase":
      return <LetterPanel facts={facts} onClaimClick={onClaimClick} activeClaimId={activeClaimId} onSent={onLetterSent} />;
    case "evidence":
      return <EvidencePanel tool={tool} />;
    case "adr":
    case "court":
    case "negotiation":
      return <AdrCourtPanel tool={tool} />;
    default:
      return tool.documentTemplate ? <pre className="doc-template">{tool.documentTemplate}</pre> : null;
  }
}
