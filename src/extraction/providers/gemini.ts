/**
 * Gemini (VLM) extraction provider. Sends documents as inlineData and forces a
 * JSON response shaped by `tenantCaseGeminiSchema`.
 */

import type {
  CaseInput,
  ExtractionProvider,
  ExtractionResult,
  FieldEvidence,
} from "../types.ts";
import { normalizeTenantCase } from "../validate.ts";
import {
  tenantCaseGeminiSchema,
  EXTRACTION_INSTRUCTIONS,
} from "../schema.ts";

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

  async extract(input: CaseInput): Promise<ExtractionResult> {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const model = new GoogleGenerativeAI(this.apiKey).getGenerativeModel({
      model: this.model,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: tenantCaseGeminiSchema,
      },
    });

    const parts: any[] = input.documents.map((d) => ({
      inlineData: { mimeType: d.mediaType, data: d.base64 },
    }));
    parts.push({ text: EXTRACTION_INSTRUCTIONS });

    const result = await model.generateContent(parts);
    const text = result.response.text();

    let raw: any;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error("GeminiProvider: response was not valid JSON");
    }

    const warnings: string[] = [];
    const tenantCase = normalizeTenantCase(raw, input, warnings);
    const evidence: FieldEvidence[] = Array.isArray(raw.evidence) ? raw.evidence : [];

    return { tenantCase, evidence, provider: this.name, warnings };
  }
}
