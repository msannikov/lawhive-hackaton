import type { DeadlineResult, QuantumResult } from "../types";

function gbp(n: number): string {
  return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  deadline: DeadlineResult;
  quantum: QuantumResult;
}

export default function DeadlineCard({ deadline, quantum }: Props) {
  return (
    <div className="card">
      <h3>What is claimed</h3>
      {quantum.deposit_return > 0 && (
        <div className="figure">
          <span>Deposit to return</span>
          <strong>{gbp(quantum.deposit_return)}</strong>
        </div>
      )}
      <div className="figure">
        <span>Penalty range (1×–3×)</span>
        <strong>
          {gbp(quantum.penalty_min)}–{gbp(quantum.penalty_max)}
        </strong>
      </div>
      <p className="note">Where the penalty falls in that range is at the court's discretion (R11).</p>

      <hr />

      <h3>Limitation</h3>
      <div className={"status status-" + deadline.status}>{deadline.status.toUpperCase()}</div>
      <div className="figure">
        <span>Expires</span>
        <strong>{deadline.limitation_expiry}</strong>
      </div>
      <div className="figure">
        <span>Days remaining</span>
        <strong>{deadline.days_remaining.toLocaleString("en-GB")}</strong>
      </div>
      {deadline.uncertainty_flag && (
        <p className="note">
          Computed from day 31 after the deposit was received; the end-of-tenancy start date is arguable but untested.
        </p>
      )}

      <hr />
      <div className="figure">
        <span>Respond by</span>
        <strong>{deadline.lbc_response_deadline}</strong>
      </div>
    </div>
  );
}
