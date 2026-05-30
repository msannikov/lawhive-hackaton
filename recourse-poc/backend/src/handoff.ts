/**
 * Handoff package (spec §3.12 — mock Lawhive). When the router escalates or
 * refuses, we bundle everything a regulated solicitor needs to pick the case up
 * cold: the full case state, the deterministic engine outputs, the reasons, an
 * evidence checklist, and a human-readable summary. The demo renders this as a
 * clean "handed to a regulated solicitor" screen.
 */
import type { DepositCase, EligibilityResult, QuantumResult, DeadlineResult } from "./models";

export interface HandoffPackage {
  id: string;
  kind: "escalate" | "refuse";
  reasons: string[];
  case: DepositCase;
  eligibility: EligibilityResult;
  quantum: QuantumResult | null; // null for out-of-scope refusals (quantum is meaningless there)
  deadline: DeadlineResult;
  evidence_checklist: string[];
  solicitor_summary: string;
}

const EVIDENCE_CHECKLIST = [
  "Copy of the tenancy agreement (AST)",
  "Proof of deposit payment (bank statement or receipt)",
  "Any correspondence with the landlord/agent about the deposit",
  "Scheme-check screenshots (DPS, MyDeposits, TDS)",
];

/** Stable, time-free id so the package is deterministic (handy for tests/demo). */
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function buildHandoff(
  kind: "escalate" | "refuse",
  c: DepositCase,
  eligibility: EligibilityResult,
  quantum: QuantumResult | null,
  deadline: DeadlineResult,
  reasons: string[],
): HandoffPackage {
  const lines = [
    `${kind === "escalate" ? "ESCALATION" : "OUT OF SCOPE"} — ${c.tenant_name}`,
    `Deposit: £${c.deposit_amount.toFixed(2)} paid ${c.date_deposit_paid}; property at ${c.property_address}.`,
    `Landlord/agent: ${c.landlord_name}, ${c.landlord_address}.`,
    `Reason: ${reasons.join(" ")}`,
  ];
  if (kind === "escalate") {
    lines.push(`Limitation expiry: ${deadline.limitation_expiry} (${deadline.days_remaining} days remaining).`);
    if (quantum) {
      lines.push(
        `Indicative quantum (court's discretion): £${quantum.penalty_min.toFixed(2)}–£${quantum.penalty_max.toFixed(2)} penalty, plus £${quantum.deposit_return.toFixed(2)} deposit return.`,
      );
    }
  }

  return {
    id: `pkg-${kind}-${slug(c.tenant_name)}`,
    kind,
    reasons,
    case: c,
    eligibility,
    quantum,
    deadline,
    evidence_checklist: EVIDENCE_CHECKLIST,
    solicitor_summary: lines.join("\n"),
  };
}
