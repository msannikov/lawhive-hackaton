/**
 * Demonstrates the negotiation loop: the system is stateless and USER-driven.
 * Each round the user reports back what happened (by advancing `context.stage`)
 * and re-runs evaluateCase. Information-gathering continues until the escalation
 * gate flips from "monitor" to "escalate" — the agent's job is done either way.
 *
 * Offline (MockProvider, deposit fixture — the unprotected case).
 * Run: node --experimental-strip-types examples/negotiationLoop.ts
 */

import { evaluateCase } from "../src/evaluateCase.ts";
import { MockProvider } from "../src/extraction/index.ts";
import { formatUK } from "../src/core/dates.ts";

const provider = new MockProvider();
const documents = [
  { name: "tenancy_agreement.pdf", kind: "pdf", mediaType: "application/pdf", base64: "" } as const,
];

const rounds = [
  { label: "Round 1 — before any contact", stage: "initial" },
  { label: "Round 2 — user sent the demand, landlord went silent", stage: "post_letter" },
];

for (const round of rounds) {
  const a = await evaluateCase(
    { documents: [...documents], context: { evaluationDate: "2026-05-30", stage: round.stage } },
    { provider },
  );

  console.log("=".repeat(72));
  console.log(round.label);
  console.log("=".repeat(72));
  console.log("Branch:        ", a.branchLabel);
  console.log("Escalation:    ", a.escalation.level.toUpperCase(), a.escalation.recommend ? "— SEE A LAWYER NOW" : "");
  console.log("  why:         ", a.escalation.reason);
  if (a.nextMove) {
    console.log("Next move:     ", a.nextMove.title, `(by ${formatUK(a.nextMove.deadline)})`);
    console.log("  rationale:   ", a.nextMove.rationale);
  }
  console.log();
}

console.log("The agent stayed self-serve while a calibrated letter could still move the");
console.log("landlord. Only after information-gathering was exhausted did it hand off.");
