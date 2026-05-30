/**
 * Public entry point.
 *
 * Input is UNSTRUCTURED documents. `evaluateCase`:
 *   1. selects a playbook (domain),
 *   2. uses a VLM provider (Claude / Gemini) to EXTRACT raw facts using the
 *      playbook's schema,
 *   3. normalises + validates them into the playbook's typed case, then
 *   4. runs the playbook's deterministic rules engine to produce branch + tools.
 *
 * Steps 1–2 are the AI part; step 4 is the auditable legal core. Adding a new
 * legal domain (e.g. employment termination) is purely a new playbook — this
 * orchestrator does not change.
 */

import "./loadEnv.ts";
import type {
  CaseInput,
  DomainAssessment,
  ExtractionProvider,
  Playbook,
} from "./core/types.ts";
import { defaultProvider } from "./extraction/index.ts";
import { getPlaybook } from "./playbooks/registry.ts";

export interface EvaluateOptions {
  /** Override the VLM backend. Defaults to one chosen from the environment. */
  provider?: ExtractionProvider;
  /** Override the playbook. Defaults to the one named by input.domain. */
  playbook?: Playbook<any>;
}

export async function evaluateCase(
  input: CaseInput,
  options: EvaluateOptions = {},
): Promise<DomainAssessment> {
  if (!input.documents?.length) {
    throw new Error("evaluateCase: no documents supplied");
  }

  const playbook = options.playbook ?? getPlaybook(input.domain);
  const provider = options.provider ?? defaultProvider();

  // 1 + 2: VLM extraction → raw facts (shaped by the playbook's schema).
  const extraction = await provider.extract(input, playbook.extraction);

  // 3: validate + normalise into the playbook's typed case.
  const warnings = [...extraction.warnings];
  const domainCase = playbook.normalize(extraction.raw, input, warnings);

  // 4: deterministic legal matching.
  const assessment = playbook.assess(domainCase);

  return {
    ...assessment,
    domain: playbook.id,
    extractedCase: domainCase,
    extraction: {
      provider: extraction.provider,
      evidence: extraction.evidence,
      warnings,
    },
  };
}
