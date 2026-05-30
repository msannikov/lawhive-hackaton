/**
 * Hono backend — the unified "legal negotiator" API.
 *
 *   Funnel:      GET  /api/taxonomy                         (the problem catalogue)
 *                GET  /api/playbooks/:domain/intake-schema  (which questions to ask)
 *   Assessment:  POST /api/assess         {domain,facts}    (Q&A → team engine)
 *                POST /api/playbooks/:domain/extract        (upload → VLM → prefill facts)
 *   Letter:      POST /api/playbooks/deposit_return/letter  (facts → grounded LBC)
 *   Demo:        GET  /api/cases, POST /api/generate        (preset DepositCases)
 *
 * The team Playbook engine (src/) owns branch + tools + dates + negotiation.
 * Recourse's grounded pipeline owns the verified deposit letter. The API never
 * returns an unverified letter — a persistent validation failure becomes a 422.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

// Recourse (deposit letter service) ------------------------------------------
import { GenerateRequestSchema } from "./models";
import { getCase, listCases } from "./cases";
import { runLetterPipeline } from "./letterPipeline";
import { serializeAssessment } from "./serialize";
import { getTaxonomy } from "./taxonomy";
import { getIntakeSchema } from "./intakeSchemas";
import { tenantCaseToDepositCase, type AdapterOverrides } from "./adapters/tenantCaseToDepositCase";
import { classifyLandlordResponse } from "./classifyResponse";

// Team engine (the Playbook framework) ---------------------------------------
import { assessFromFacts } from "../../../src/assessFromFacts.ts";
import { evaluateCase } from "../../../src/evaluateCase.ts";
import type { TenantCase } from "../../../src/playbooks/depositReturn/case.ts";

const app = new Hono();
app.use("/api/*", cors());

/** Today as YYYY-MM-DD — the default "now" for deadline arithmetic. */
const today = () => new Date().toISOString().slice(0, 10);

app.get("/", (ctx) => ctx.text("Legal-negotiator API. Try GET /api/taxonomy."));

// ── Funnel ──────────────────────────────────────────────────────────────────
app.get("/api/taxonomy", (ctx) => ctx.json(getTaxonomy()));

app.get("/api/playbooks/:domain/intake-schema", (ctx) => {
  const schema = getIntakeSchema(ctx.req.param("domain"));
  if (!schema) return ctx.json({ error: "unknown_domain", domain: ctx.req.param("domain") }, 404);
  return ctx.json(schema);
});

// ── Assessment from intake facts (no VLM) ────────────────────────────────────
app.post("/api/assess", async (ctx) => {
  const body = await ctx.req.json().catch(() => ({}));
  const { domain, facts, context } = body ?? {};
  if (!facts || typeof facts !== "object") return ctx.json({ error: "missing_facts" }, 400);
  try {
    const assessment = assessFromFacts(facts, {
      domain,
      context: { evaluationDate: today(), ...(context ?? {}) },
    });
    return ctx.json(serializeAssessment(assessment));
  } catch (e) {
    // A missing/unparseable required fact surfaces here as a clean 400.
    return ctx.json({ error: "invalid_facts", detail: (e as Error).message }, 400);
  }
});

// ── Document-upload accelerator: VLM extraction → prefill facts ──────────────
app.post("/api/playbooks/:domain/extract", async (ctx) => {
  const domain = ctx.req.param("domain");
  const body = await ctx.req.json().catch(() => ({}));
  const documents = body?.documents;
  if (!Array.isArray(documents) || documents.length === 0) {
    return ctx.json({ error: "no_documents" }, 400);
  }
  try {
    const result = await evaluateCase({ documents, domain, context: body?.context });
    // The normalised case is returned as prefill facts (nested, dotted-path shape)
    // alongside the provenance the model cited. Offline, MockProvider returns the
    // bundled fixture so the upload demo works with no API key.
    return ctx.json({
      facts: result.extractedCase,
      evidence: result.extraction.evidence,
      warnings: result.extraction.warnings,
      provider: result.extraction.provider,
    });
  } catch (e) {
    return ctx.json({ error: "extraction_failed", detail: (e as Error).message }, 422);
  }
});

// ── Deposit grounded letter (Recourse pipeline) ──────────────────────────────
app.post("/api/playbooks/deposit_return/letter", async (ctx) => {
  const body = await ctx.req.json().catch(() => ({}));
  const { facts, context, overrides } = body ?? {};
  if (!facts || typeof facts !== "object") return ctx.json({ error: "missing_facts" }, 400);
  try {
    const assessment = assessFromFacts(facts, {
      domain: "deposit_return",
      context: { evaluationDate: today(), ...(context ?? {}) },
    });
    const depositCase = tenantCaseToDepositCase(
      assessment.extractedCase as TenantCase,
      (overrides ?? {}) as AdapterOverrides,
    );
    const result = await runLetterPipeline(depositCase);
    return ctx.json(result.body, result.status);
  } catch (e) {
    return ctx.json({ error: "letter_failed", detail: (e as Error).message }, 400);
  }
});

// ── Classify a pasted landlord reply (AI at the edge; heuristic offline) ─────
app.post("/api/playbooks/:domain/classify-response", async (ctx) => {
  const body = await ctx.req.json().catch(() => ({}));
  const message = typeof body?.message === "string" ? body.message : "";
  const result = await classifyLandlordResponse(message);
  return ctx.json(result);
});

// ── Demo preset cases (back-compat) ──────────────────────────────────────────
app.get("/api/cases", (ctx) => ctx.json(listCases()));

app.post("/api/generate", async (ctx) => {
  const body = await ctx.req.json().catch(() => ({}));
  const parsed = GenerateRequestSchema.safeParse(body);
  if (!parsed.success) return ctx.json({ error: "invalid_request" }, 400);

  const c = getCase(parsed.data.case_id);
  if (!c) return ctx.json({ error: "unknown_case", case_id: parsed.data.case_id }, 404);

  const result = await runLetterPipeline(c);
  return ctx.json(result.body, result.status);
});

const port = Number(process.env.PORT || 8000);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`✓ Legal-negotiator backend listening on http://localhost:${info.port}`);
});
