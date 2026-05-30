/**
 * The deposit letter pipeline, shared by the demo route (/api/generate, fed a
 * preset DepositCase) and the funnel route (/api/playbooks/deposit_return/letter,
 * fed facts → adapter → DepositCase). One place owns the proceed/escalate/refuse
 * decision and the generate → validate → retry → assemble sequence, so both
 * routes behave identically and never ship an unverified letter.
 */
import type { DepositCase } from "./models";
import { computeEligibility } from "./engines/eligibility";
import { computeQuantum } from "./engines/quantum";
import { computeDeadline } from "./engines/deadline";
import { routeEscalation } from "./escalation";
import { buildHandoff } from "./handoff";
import { generateLetter } from "./generation";
import { validateClaims } from "./validator";
import { assembleLetter } from "./assembler";

export type LetterPipelineResult =
  | { status: 200; body: Record<string, unknown> } // letter or handoff
  | { status: 422; body: Record<string, unknown> }; // unverifiable letter

export async function runLetterPipeline(c: DepositCase): Promise<LetterPipelineResult> {
  // 1. Deterministic engines.
  const eligibility = computeEligibility(c);
  const quantum = computeQuantum(c);
  const deadline = computeDeadline(c);

  // 2. Escalation router — proceed / escalate / refuse.
  const decision = routeEscalation(c, eligibility, deadline);
  if (decision.kind !== "proceed") {
    const handoffQuantum = decision.kind === "escalate" ? quantum : null;
    const handoff = buildHandoff(decision.kind, c, eligibility, handoffQuantum, deadline, decision.reasons);
    return {
      status: 200,
      body: {
        outcome: decision.kind,
        escalation: { ...decision, handoff_package_id: handoff.id },
        handoff,
      },
    };
  }

  // 3. Generate (Claude or fixture) → validate → retry once (live only) → assemble.
  const engines = { eligibility, quantum, deadline };
  let gen = await generateLetter(c, engines);
  let validation = validateClaims(gen.emit);

  if (!validation.ok && gen.source === "live") {
    const feedback = validation.failures.map((f) => `${f.claim_id} (${f.source_id}): ${f.reason}`).join("; ");
    gen = await generateLetter(c, engines, feedback);
    validation = validateClaims(gen.emit);
  }

  if (!validation.ok) {
    // Never ship an unverifiable letter (§3.8).
    return { status: 422, body: { error: "validation_failed", failures: validation.failures } };
  }

  const letter = assembleLetter(c, validation.claims, quantum, deadline, gen.emit.letter_sections);
  return {
    status: 200,
    body: {
      outcome: "letter",
      letter,
      engines: { eligibility, quantum },
      meta: { source: gen.source, validator: "all_passed", model_id: gen.model_id },
    },
  };
}
