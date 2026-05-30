import type { Tool } from "../../types";

export default function AdrCourtPanel({ tool }: { tool: Tool }) {
  const isCourt = tool.category === "court";
  return (
    <div className="panel adr-court-panel">
      <p>{tool.nextAction}</p>
      <div className="cta-box">
        {isCourt ? (
          <>
            <strong>This is the decision step.</strong>
            <p>
              A court claim is irreversible and the penalty multiplier (1×–3×) is at the court's discretion. Most
              people bring in a regulated solicitor before filing.
            </p>
            <button type="button" className="primary-btn" disabled title="Demo only">
              Find a regulated solicitor
            </button>
          </>
        ) : (
          <p>Use the scheme's free dispute resolution (ADR) before court — it's neutral, and it costs nothing.</p>
        )}
      </div>
    </div>
  );
}
