/**
 * Public entry point.
 *
 * The system's input is UNSTRUCTURED documents (tenancy agreement PDF, bank
 * statement PDF, scheme screenshots). `evaluateCase`:
 *
 *   1. uses a VLM provider (Claude / Gemini) to EXTRACT a structured TenantCase
 *      from those documents,
 *   2. validates + normalises the extraction, then
 *   3. applies the deterministic rules engine (`matchToolset`) to produce the
 *      branch + concrete toolset.
 *
 * Step 1 is the non-deterministic, AI part; step 3 is the auditable legal core.
 */

import "./loadEnv.ts";
import { matchToolset } from "./toolset/orchestrator.ts";
import { defaultProvider } from "./extraction/index.ts";
import type {
  CaseInput,
  DocumentAssessment,
  ExtractionProvider,
} from "./extraction/types.ts";

export interface EvaluateOptions {
  /** Override the VLM backend. Defaults to one chosen from the environment. */
  provider?: ExtractionProvider;
}

export async function evaluateCase(
  input: CaseInput,
  options: EvaluateOptions = {},
): Promise<DocumentAssessment> {
  if (!input.documents?.length) {
    throw new Error("evaluateCase: no documents supplied");
  }

  const provider = options.provider ?? defaultProvider();

  // 1 + 2: VLM extraction → validated TenantCase.
  const extraction = await provider.extract(input);

  // 3: deterministic legal matching.
  const assessment = matchToolset(extraction.tenantCase);

  return {
    ...assessment,
    extractedCase: extraction.tenantCase,
    extraction: {
      provider: extraction.provider,
      evidence: extraction.evidence,
      warnings: extraction.warnings,
    },
  };
}
