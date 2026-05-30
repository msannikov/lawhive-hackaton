import { useEffect, useState } from "react";
import { fetchCases, generate } from "./api";
import type { CaseSummary, GenerateResponse, GroundedClaim } from "./types";
import CasePicker from "./components/CasePicker";
import Letter from "./components/Letter";
import DeadlineCard from "./components/DeadlineCard";
import ProvenanceDrawer from "./components/ProvenanceDrawer";
import HandoffScreen from "./components/HandoffScreen";

export default function App() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeClaim, setActiveClaim] = useState<GroundedClaim | null>(null);

  useEffect(() => {
    fetchCases().then(setCases).catch((e) => console.error(e));
  }, []);

  async function pick(id: string) {
    setSelected(id);
    setResult(null);
    setActiveClaim(null);
    setLoading(true);
    try {
      setResult(await generate(id));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <h1>Recourse</h1>
          <p className="tagline">Tenancy deposit recovery — every legal sentence grounded in primary law.</p>
        </div>
      </header>

      <CasePicker cases={cases} selected={selected} onPick={pick} />

      {loading && <div className="loading">Running the pipeline…</div>}

      {result && result.outcome === "letter" && (
        <div className="result-grid">
          <Letter
            letter={result.letter}
            meta={result.meta}
            onClaimClick={setActiveClaim}
            activeClaimId={activeClaim?.claim_id ?? null}
          />
          <aside className="sidebar">
            <DeadlineCard deadline={result.letter.deadline} quantum={result.engines.quantum} />
          </aside>
        </div>
      )}

      {result && (result.outcome === "escalate" || result.outcome === "refuse") && (
        <HandoffScreen data={result} />
      )}

      <ProvenanceDrawer claim={activeClaim} onClose={() => setActiveClaim(null)} />
    </div>
  );
}
