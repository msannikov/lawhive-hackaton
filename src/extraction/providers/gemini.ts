/**
 * Gemini (VLM) extraction provider. Sends documents as inlineData and forces a
 * JSON response shaped by the active playbook's schema. Returns RAW model
 * output; the playbook normalises it.
 */

import type {
  CaseInput,
  ExtractionProvider,
  ExtractionSpec,
  FieldEvidence,
  RawExtraction,
} from "../../core/types.ts";

export interface GeminiProviderOptions {
  apiKey?: string;
  model?: string;
}

export class GeminiProvider implements ExtractionProvider {
  readonly name = "gemini";
  private apiKey: string;
  private model: string;

  constructor(opts: GeminiProviderOptions = {}) {
    const key = opts.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    if (!key) throw new Error("GeminiProvider: GEMINI_API_KEY not set");
    this.apiKey = key;
    // Flash is available on the free tier; Pro has limit:0 there.
    this.model = opts.model ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  }

  async extract(input: CaseInput, spec: ExtractionSpec): Promise<RawExtraction> {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const model = new GoogleGenerativeAI(this.apiKey).getGenerativeModel({
      model: this.model,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: spec.geminiSchema,
      },
    });

    const parts: any[] = input.documents.map((d) => ({
      inlineData: { mimeType: d.mediaType, data: d.base64 },
    }));
    parts.push({ text: spec.instructions });

    const result = await model.generateContent(parts);
    const text = result.response.text();

    let raw: any;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error("GeminiProvider: response was not valid JSON");
    }

    const evidence: FieldEvidence[] = Array.isArray(raw.evidence) ? raw.evidence : [];
    return { raw, evidence, provider: this.name, warnings: [] };
  }
}
