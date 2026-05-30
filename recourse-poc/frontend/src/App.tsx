import { useEffect, useState } from "react";
import { fetchTaxonomy, fetchIntakeSchema, assess } from "./api";
import type {
  Taxonomy,
  TaxonomyArea,
  TaxonomyLeaf,
  IntakeSchema,
  CaseAssessment,
  Facts,
  GroundedClaim,
} from "./types";
import Stepper, { type Step } from "./components/Stepper";
import AreaPicker from "./components/AreaPicker";
import SubAreaPicker from "./components/SubAreaPicker";
import IntakeForm from "./components/IntakeForm";
import Assessment from "./components/Assessment";
import ToolDetail from "./components/ToolDetail";
import ProvenanceDrawer from "./components/ProvenanceDrawer";

export default function App() {
  const [step, setStep] = useState<Step>("landing");
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [area, setArea] = useState<TaxonomyArea | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [intakeSchema, setIntakeSchema] = useState<IntakeSchema | null>(null);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [assessment, setAssessment] = useState<CaseAssessment | null>(null);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [activeClaim, setActiveClaim] = useState<GroundedClaim | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTaxonomy().then(setTaxonomy).catch((e) => setError(String(e)));
  }, []);

  function pickArea(a: TaxonomyArea) {
    if (a.status !== "live") return;
    setArea(a);
    setStep("subarea");
  }

  async function pickSubArea(leaf: TaxonomyLeaf) {
    if (leaf.status !== "live" || !leaf.domain) return;
    setDomain(leaf.domain);
    setError(null);
    setLoading(true);
    try {
      setIntakeSchema(await fetchIntakeSchema(leaf.domain));
      setStep("intake");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function submitIntake(collected: Facts) {
    if (!domain) return;
    setFacts(collected);
    setError(null);
    setLoading(true);
    try {
      setAssessment(await assess(domain, collected));
      setStep("assessment");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function openTool(id: string) {
    setActiveToolId(id);
    setStep("toolDetail");
  }

  function goTo(s: Step) {
    if (s !== "toolDetail") setActiveToolId(null);
    setStep(s);
  }

  const activeTool = assessment?.tools.find((t) => t.id === activeToolId) ?? null;

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <h1>Recourse</h1>
          <p className="tagline">Know your next move — and the date it's due.</p>
        </div>
      </header>

      <Stepper step={step} area={area} onNavigate={goTo} />

      {error && <div className="error">{error}</div>}
      {loading && <div className="loading">Working…</div>}

      {!loading && step === "landing" && taxonomy && <AreaPicker taxonomy={taxonomy} onPick={pickArea} />}

      {!loading && step === "subarea" && area && (
        <SubAreaPicker area={area} onPick={pickSubArea} onBack={() => goTo("landing")} />
      )}

      {!loading && step === "intake" && intakeSchema && domain && (
        <IntakeForm schema={intakeSchema} domain={domain} onSubmit={submitIntake} />
      )}

      {!loading && step === "assessment" && assessment && (
        <Assessment assessment={assessment} onOpenTool={openTool} />
      )}

      {!loading && step === "toolDetail" && activeTool && assessment && facts && (
        <ToolDetail
          tool={activeTool}
          assessment={assessment}
          facts={facts}
          onClaimClick={setActiveClaim}
          activeClaimId={activeClaim?.claim_id ?? null}
          onBack={() => goTo("assessment")}
        />
      )}

      <ProvenanceDrawer claim={activeClaim} onClose={() => setActiveClaim(null)} />
    </div>
  );
}
