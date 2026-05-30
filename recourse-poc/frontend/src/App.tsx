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
  NegStage,
  LandlordResponse,
  LogEvent,
} from "./types";
import { todayISO, addDays, formatDate } from "./lib/date";
import Stepper, { type Step } from "./components/Stepper";
import AreaPicker from "./components/AreaPicker";
import SubAreaPicker from "./components/SubAreaPicker";
import IntakeForm from "./components/IntakeForm";
import Assessment from "./components/Assessment";
import ToolDetail from "./components/ToolDetail";
import ProvenanceDrawer from "./components/ProvenanceDrawer";
import type { NegotiationApi } from "./components/NegotiationPanel";

const RESPONSE_LABEL: Record<LandlordResponse, string> = {
  agrees_in_full: "Agreed to return it in full",
  disputes_deductions: "Wants to make deductions",
  silent: "No response",
  unknown: "Unclear",
};

let eventSeq = 0;

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

  // Negotiation state
  const [stage, setStage] = useState<NegStage>("initial");
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [awaiting, setAwaiting] = useState<{ since: string; dueBy: string } | null>(null);
  const [resolved, setResolved] = useState<{ at: string; note?: string } | null>(null);

  useEffect(() => {
    fetchTaxonomy().then(setTaxonomy).catch((e) => setError(String(e)));
  }, []);

  function pushEvent(title: string, opts: { detail?: string; tone?: LogEvent["tone"] } = {}) {
    setEvents((evs) => [...evs, { id: `e${eventSeq++}`, at: todayISO(), title, detail: opts.detail, tone: opts.tone ?? "neutral" }]);
  }

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
    setStage("initial");
    setEvents([]);
    setAwaiting(null);
    setResolved(null);
    setError(null);
    setLoading(true);
    try {
      setAssessment(await assess(domain, collected, { stage: "initial" }));
      setStep("assessment");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function reassess(nextFacts: Facts, nextStage: NegStage) {
    if (!domain) return;
    setFacts(nextFacts);
    setStage(nextStage);
    setError(null);
    setLoading(true);
    try {
      setAssessment(await assess(domain, nextFacts, { stage: nextStage }));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  // ── Negotiation handlers ─────────────────────────────────────────────────
  function onSent() {
    const since = todayISO();
    const dueBy = addDays(since, 14);
    setAwaiting({ since, dueBy });
    pushEvent("Sent the Letter Before Action", { tone: "good", detail: `14-day response window — reply due by ${formatDate(dueBy)}.` });
  }

  function onResponse(category: LandlordResponse, note?: string) {
    const next: Facts = { ...(facts ?? {}), landlordResponse: category };
    setAwaiting(null);
    pushEvent(`Landlord: ${RESPONSE_LABEL[category]}`, {
      detail: note,
      tone: category === "agrees_in_full" ? "good" : category === "disputes_deductions" ? "warn" : "neutral",
    });
    // Agreement doesn't escalate; any other reply means the letter step is done.
    reassess(next, category === "agrees_in_full" ? stage : "post_letter");
  }

  function onNoResponse() {
    const next: Facts = { ...(facts ?? {}), landlordResponse: "silent" };
    setAwaiting(null);
    pushEvent("No response by the deadline", { tone: "bad", detail: "Information-gathering exhausted — time to escalate." });
    reassess(next, "post_letter");
  }

  function onAdrUnresolved() {
    pushEvent("Scheme ADR did not resolve it", { tone: "warn" });
    if (facts) reassess(facts, "post_adr");
  }

  function onResolve(note?: string) {
    setResolved({ at: todayISO(), note });
    pushEvent("Deposit recovered — case resolved", { tone: "good", detail: note });
  }

  function openTool(id: string) {
    setActiveToolId(id);
    setStep("toolDetail");
  }
  function goTo(s: Step) {
    if (s !== "toolDetail") setActiveToolId(null);
    setStep(s);
  }
  function onLetterSent() {
    onSent();
    setStep("assessment");
  }

  const activeTool = assessment?.tools.find((t) => t.id === activeToolId) ?? null;

  const neg: NegotiationApi = {
    stage,
    events,
    awaiting,
    resolved,
    domain: domain ?? "",
    onSent,
    onResponse,
    onNoResponse,
    onAdrUnresolved,
    onResolve,
  };

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <h1>Recourse</h1>
          <p className="tagline">Your next move, the date it's due, and what to do when the landlord replies.</p>
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
        <Assessment assessment={assessment} neg={neg} onOpenTool={openTool} />
      )}

      {!loading && step === "toolDetail" && activeTool && assessment && facts && (
        <ToolDetail
          tool={activeTool}
          assessment={assessment}
          facts={facts}
          onClaimClick={setActiveClaim}
          activeClaimId={activeClaim?.claim_id ?? null}
          onBack={() => goTo("assessment")}
          onLetterSent={onLetterSent}
        />
      )}

      <ProvenanceDrawer claim={activeClaim} onClose={() => setActiveClaim(null)} />
    </div>
  );
}
