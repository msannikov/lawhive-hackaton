/**
 * Quantum engine (spec §3.4) — pure function `case → QuantumResult`.
 *
 * The penalty is a RANGE, never a single figure (R7 = 1×–3× the deposit; the
 * multiplier is at the court's discretion, R11). Money is computed in integer
 * pence to avoid floating-point drift in a legally load-bearing number.
 *
 * Multi-tenancy roll-overs (R9, Superstrike) are deliberately NOT auto-computed
 * here — the escalation router diverts those cases to a human before generation,
 * so this engine always reports the single-tenancy base.
 */
import type { DepositCase, QuantumResult } from "../models";

const toPence = (pounds: number) => Math.round(pounds * 100);
const toPounds = (pence: number) => pence / 100;

export function computeQuantum(c: DepositCase): QuantumResult {
  const depositPence = toPence(c.deposit_amount);
  const returnedPence = toPence(c.amount_returned);

  // R6: outstanding deposit to be repaid (never negative).
  const depositReturnPence = Math.max(0, depositPence - returnedPence);

  // R7: statutory penalty band — 1× to 3× the deposit.
  const penalty_min = toPounds(depositPence);
  const penalty_max = toPounds(depositPence * 3);
  const deposit_return = toPounds(depositReturnPence);

  const basis: string[] = [];
  if (deposit_return > 0) basis.push("R6");
  basis.push("R7");

  return {
    deposit_return,
    penalty_min,
    penalty_max,
    tenancy_count: 1,
    basis,
    discretion_note_ref: "R11",
  };
}
