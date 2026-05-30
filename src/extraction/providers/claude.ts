/**
 * Claude (VLM) extraction provider. Sends the documents (PDFs + screenshots) and
 * forces structured output via tool use, using the schema supplied by the
 * active playbook. PDFs use the document channel; images use the vision channel.
 *
 * It returns RAW model output; the playbook is responsible for normalisation.
 */

import type {
  CaseInput,
  ExtractionProvider,
  ExtractionSpec,
  FieldEvidence,
  RawExtraction,
} from "../../core/types.ts";

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
    this.model = opts.model ?? process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7";
  }

  async extract(input: CaseInput, spec: ExtractionSpec): Promise<RawExtraction> {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: this.apiKey });

    const content: any[] = input.documents.map((d) =>
      d.kind === "pdf"
        ? { type: "document", source: { type: "base64", media_type: d.mediaType, data: d.base64 }, title: d.name }
        : { type: "image", source: { type: "base64", media_type: d.mediaType, data: d.base64 } },
    );
    content.push({ type: "text", text: spec.instructions });

    const resp = await client.messages.create({
      model: this.model,
      max_tokens: 2048,
      tools: [{
        name: "submit_case",
        description: "Submit the structured facts extracted from the documents.",
        input_schema: spec.jsonSchema as any,
      }],
      tool_choice: { type: "tool", name: "submit_case" },
      messages: [{ role: "user", content }],
    });

    const block = resp.content.find((b: any) => b.type === "tool_use") as any;
    if (!block) throw new Error("ClaudeProvider: model did not return structured output");

    const raw = block.input;
    const evidence: FieldEvidence[] = Array.isArray(raw.evidence) ? raw.evidence : [];
    return { raw, evidence, provider: this.name, warnings: [] };
  }
}
