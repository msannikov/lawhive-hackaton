/**
 * Hono backend (spec §2). One pipeline, three terminal outcomes.
 *
 *   hardcoded case → engines → escalation router
 *     ├─ proceed  → generate (Claude/fixture) → validate → assemble → letter
 *     └─ escalate/refuse → handoff package
 *
 * Numbers and deadlines are computed by the engines; legal text is verified by
 * the validator; the model only selects + fills. The endpoint never returns an
 * unverified letter — a persistent validation failure becomes a 422.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { GenerateRequestSchema } from "./models";
import { getCase, listCases } from "./cases";
import { computeEligibility } from "./engines/eligibility";
import { computeQuantum } from "./engines/quantum";
import { computeDeadline } from "./engines/deadline";
import { routeEscalation } from "./escalation";
import { buildHandoff } from "./handoff";
import { generateLetter } from "./generation";
import { validateClaims } from "./validator";
import { assembleLetter } from "./assembler";

const app = new Hono();
app.use("/api/*", cors());

app.get("/", (ctx) => ctx.text("Recourse deposit-return POC backend. Try GET /api/cases."));

app.get("/api/cases", (ctx) => ctx.json(listCases()));

app.post("/api/generate", async (ctx) => {
  const body = await ctx.req.json().catch(() => ({}));
  const parsed = GenerateRequestSchema.safeParse(body);
  if (!parsed.success) return ctx.json({ error: "invalid_request" }, 400);

  const c = getCase(parsed.data.case_id);
  if (!c) return ctx.json({ error: "unknown_case", case_id: parsed.data.case_id }, 404);

  // 1. Deterministic engines.
  const eligibility = computeEligibility(c);
  const quantum = computeQuantum(c);
  const deadline = computeDeadline(c);

  // 2. Escalation router — proceed / escalate / refuse.
  const decision = routeEscalation(c, eligibility, deadline);
  if (decision.kind !== "proceed") {
    const handoffQuantum = decision.kind === "escalate" ? quantum : null;
    const handoff = buildHandoff(decision.kind, c, eligibility, handoffQuantum, deadline, decision.reasons);
    return ctx.json({
      outcome: decision.kind,
      escalation: { ...decision, handoff_package_id: handoff.id },
      handoff,
    });
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
    return ctx.json({ error: "validation_failed", failures: validation.failures }, 422);
  }

  const letter = assembleLetter(c, validation.claims, quantum, deadline, gen.emit.letter_sections);
  return ctx.json({
    outcome: "letter",
    letter,
    engines: { eligibility, quantum },
    meta: { source: gen.source, validator: "all_passed", model_id: gen.model_id },
  });
});

const port = Number(process.env.PORT || 8000);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`✓ Recourse backend listening on http://localhost:${info.port}`);
});
