/**
 * Claude (VLM) extraction provider. Sends the documents (PDFs + screenshots) and
 * forces structured output via tool use, so the model returns exactly the
 * extraction schema. PDFs use the document channel; images use the vision channel.
 */

import type {
  CaseInput,
  ExtractionProvider,
  ExtractionResult,
  FieldEvidence,
} from "../types.ts";
import { normalizeTenantCase } from "../validate.ts";
import {
  tenantCaseJsonSchema,
  EXTRACTION_INSTRUCTIONS,
} from "../schema.ts";

export interface ClaudeProviderOptions {
  apiKey?: string;
  model?: string;
}

export class ClaudeProvider implements ExtractionProvider {
  readonly name = "claude";
  private apiKey: string;
  private model: string;

  constructor(opts: ClaudeProviderOptions = {}) {
    const key = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ClaudeProvider: ANTHROPIC_API_KEY not set");
    this.apiKey = key;
    this.model = opts.model ?? "claude-opus-4-7";
  }

  async extract(input: CaseInput): Promise<ExtractionResult> {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: this.apiKey });

    const content: any[] = input.documents.map((d) =>
      d.kind === "pdf"
        ? { type: "document", source: { type: "base64", media_type: d.mediaType, data: d.base64 }, title: d.name }
        : { type: "image", source: { type: "base64", media_type: d.mediaType, data: d.base64 } },
    );
    content.push({ type: "text", text: EXTRACTION_INSTRUCTIONS });

    const resp = await client.messages.create({
      model: this.model,
      max_tokens: 2048,
      tools: [{
        name: "submit_tenant_case",
        description: "Submit the structured facts extracted from the documents.",
        input_schema: tenantCaseJsonSchema as any,
      }],
      tool_choice: { type: "tool", name: "submit_tenant_case" },
      messages: [{ role: "user", content }],
    });

    const block = resp.content.find((b: any) => b.type === "tool_use") as any;
    if (!block) throw new Error("ClaudeProvider: model did not return structured output");

    const warnings: string[] = [];
    const raw = block.input;
    const tenantCase = normalizeTenantCase(raw, input, warnings);
    const evidence: FieldEvidence[] = Array.isArray(raw.evidence) ? raw.evidence : [];

    return { tenantCase, evidence, provider: this.name, warnings };
  }
}
