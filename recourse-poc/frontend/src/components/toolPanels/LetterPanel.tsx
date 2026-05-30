import { useEffect, useState } from "react";
import type { Facts, GroundedClaim, GenerateResponse } from "../../types";
import { fetchDepositLetter } from "../../api";
import Letter from "../Letter";
import DeadlineCard from "../DeadlineCard";
import HandoffScreen from "../HandoffScreen";

interface Props {
  facts: Facts;
  onClaimClick: (c: GroundedClaim) => void;
  activeClaimId: string | null;
}

export default function LetterPanel({ facts, onClaimClick, activeClaimId }: Props) {
  const [resp, setResp] = useState<GenerateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    fetchDepositLetter(facts)
      .then((r) => live && setResp(r))
      .catch((e) => live && setError(String(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [facts]);

  if (loading) return <div className="loading">Drafting your letter and grounding every legal sentence…</div>;
  if (error) return <div className="error">{error}</div>;
  if (!resp) return null;

  if (resp.outcome === "letter") {
    return (
      <div className="letter-layout">
        <Letter letter={resp.letter} meta={resp.meta} onClaimClick={onClaimClick} activeClaimId={activeClaimId} />
        <aside className="letter-side">
          <DeadlineCard deadline={resp.letter.deadline} quantum={resp.engines.quantum} />
        </aside>
      </div>
    );
  }
  return <HandoffScreen data={resp} />;
}
