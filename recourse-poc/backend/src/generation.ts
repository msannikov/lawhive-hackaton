/**
 * Generation pipeline (spec §3.7) — the ONLY place the model is involved.
 *
 * The model SELECTS claim_ids from the registry and FILLS narrative slots via a
 * single FORCED tool call (emit_letter). It is given the engine numbers as data
 * and told never to recompute them, and the full source text and told to copy
 * each verbatim_quote exactly. It cannot assert a proposition outside the
 * registry. Everything it returns is then re-checked by the deterministic
 * validator — the model is never trusted, only constrained then verified.
 *
 * Fixture-first: with no ANTHROPIC_API_KEY (or USE_FIXTURE=1) we load a recorded
 * emit_letter output so the whole demo runs offline. The fixture's quotes are
 * real substrings of the grounding store, so it passes the SAME validator — the
 * green ticks are genuine even offline.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  EmitLetterSchema,
  type EmitLetter,
  type DepositCase,
  type EligibilityResult,
  type QuantumResult,
  type DeadlineResult,
} from "./models";
import { ALLOWED_CLAIMS } from "./registry";
import { getChunk } from "./grounding";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, "..", "data", "fixture_jamie.json");

// const MODEL_ID = process.env.MODEL_ID || "claude-opus-4-8";
const MODEL_ID = process.env.MODEL_ID || "claude-haiku-4-5";

export interface EngineOutputs {
  eligibility: EligibilityResult;
  quantum: QuantumResult;
  deadline: DeadlineResult;
}

export interface GenerationResult {
  emit: EmitLetter;
  source: "fixture" | "live";
  model_id: string | null;
}

function shouldUseFixture(): boolean {
  return process.env.USE_FIXTURE === "1" || !process.env.ANTHROPIC_API_KEY;
}

function loadFixture(): EmitLetter {
  // Parsed through the SAME schema the live output must satisfy.
  return EmitLetterSchema.parse(JSON.parse(readFileSync(FIXTURE_PATH, "utf8")));
}

// ── Static, cacheable prompt material ────────────────────────────────────────
const SYSTEM_PROMPT = `You are a calm, plain-English assistant for "Law Gun", helping a tenant in England & Wales recover a mishandled tenancy deposit by drafting a Letter Before Claim at the user's instruction.

Non-negotiable rules:
- You provide legal INFORMATION and drafting, never advice on the merits.
- You may assert ONLY the legal propositions in the allowed-claims registry below. Never state any other legal proposition.
- For every claim you emit, copy "verbatim_quote" EXACTLY (character for character) from that claim's SOURCE TEXT. Do not paraphrase, summarise, or invent statute wording.
- Use ONLY the numbers, dates and amounts supplied in the CASE and ENGINE data. Never compute, round, or alter a figure. Do NOT put specific monetary amounts in the letter_sections — those are inserted separately from verified engine data.
- Tone: firm and courteous, never a threat (Pre-Action Protocol for Conduct).
- Respond ONLY by calling the emit_letter tool.`;

function renderRegistryBlock(): string {
  const lines = [
    "ALLOWED-CLAIMS REGISTRY — you may select only these claim_ids, and must copy verbatim_quote exactly from each SOURCE TEXT:",
    "",
  ];
  for (const e of Object.values(ALLOWED_CLAIMS)) {
    const chunk = getChunk(e.source_id);
    lines.push(`claim_id ${e.claim_id} — ${e.proposition}`);
    lines.push(`  source_id: ${e.source_id} (${e.citation})`);
    lines.push(`  SOURCE TEXT: ${JSON.stringify(chunk?.text ?? "")}`);
    lines.push("");
  }
  return lines.join("\n");
}
const REGISTRY_BLOCK = renderRegistryBlock();

function renderUserMessage(c: DepositCase, eng: EngineOutputs, feedback?: string): string {
  const parts = [
    "CASE (facts captured at intake):",
    JSON.stringify(c, null, 2),
    "",
    "ENGINE OUTPUTS (authoritative — the letter's figures come from here, not from you):",
    JSON.stringify(eng, null, 2),
    "",
    "TASK:",
    "- Select the claim_ids that apply: R1/R2 for the breaches found, R4 for the right to apply to court, R5 ONLY if the tenancy has ended, R6 if a deposit is outstanding, R7 for the penalty.",
    "- Fill the six letter_sections (intro, facts, breach, claim, adr, next_steps) in plain, courteous English. Keep specific £ amounts and dates OUT of the prose.",
    "- For each selected claim, emit one claims[] entry: { claim_id, rendered_sentence, source_id, verbatim_quote } where verbatim_quote is copied EXACTLY from that claim's SOURCE TEXT.",
  ];
  if (feedback) {
    parts.push("", "PRIOR ATTEMPT FAILED VALIDATION:", feedback, "Copy the verbatim_quote exactly from the SOURCE TEXT shown in the registry.");
  }
  return parts.join("\n");
}

/** Build the Anthropic tool input_schema from the Zod schema (Zod v4 native). */
function toolInputSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(EmitLetterSchema) as Record<string, unknown>;
  delete schema["$schema"]; // Anthropic wants a bare JSON-schema object
  return schema;
}

export async function generateLetter(
  c: DepositCase,
  engines: EngineOutputs,
  feedback?: string,
): Promise<GenerationResult> {
  if (shouldUseFixture()) {
    return { emit: loadFixture(), source: "fixture", model_id: null };
  }

  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const res = await client.messages.create({
    model: MODEL_ID,
    max_tokens: 4096,
    system: [
      // Static blocks → marked for prompt caching (cheap, faster on repeat).
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      { type: "text", text: REGISTRY_BLOCK, cache_control: { type: "ephemeral" } },
    ],
    tools: [
      {
        name: "emit_letter",
        description: "Emit the structured Letter Before Claim (selected claims + narrative sections).",
        input_schema: toolInputSchema() as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "emit_letter" },
    messages: [{ role: "user", content: renderUserMessage(c, engines, feedback) }],
  });

  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not call emit_letter");
  }
  // Re-validate the shape: forcing tool_choice guarantees the tool fires, but
  // not the shape — Zod is our guarantee (parse failure → caller retries).
  return { emit: EmitLetterSchema.parse(toolUse.input), source: "live", model_id: MODEL_ID };
}
