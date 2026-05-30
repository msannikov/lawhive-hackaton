import type { GenerateResponse } from "../types";

type HandoffData = Extract<GenerateResponse, { outcome: "escalate" | "refuse" }>;

export default function HandoffScreen({ data }: { data: HandoffData }) {
  const { outcome, escalation, handoff } = data;
  const refuse = outcome === "refuse";

  return (
    <section className="handoff">
      <div className={"handoff-banner " + outcome}>
        {refuse ? "Out of scope — we can’t automate this safely" : "Handed to a regulated solicitor"}
      </div>

      <h3>Why</h3>
      <ul>
        {escalation.reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>

      {!refuse && (
        <>
          <h3>What the solicitor receives</h3>
          <pre className="summary">{handoff.solicitor_summary}</pre>
          <h3>Evidence checklist</h3>
          <ul>
            {handoff.evidence_checklist.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </>
      )}

      {refuse && <p className="note">{handoff.solicitor_summary}</p>}

      <details className="case-file">
        <summary>Full case file (JSON)</summary>
        <pre>{JSON.stringify(handoff, null, 2)}</pre>
      </details>
    </section>
  );
}
