/**
 * No-VLM entry point: build a {@link CaseAssessment} directly from already-
 * structured facts (e.g. a guided intake form), skipping document extraction.
 *
 * `evaluateCase()` requires documents and runs a VLM provider; this is its
 * sibling for the question-and-answer path. It reuses the SAME validation
 * (`playbook.normalize`) and the SAME rules engine (`playbook.assess`), so a
 * form-driven case and a document-driven case go through identical legal logic —
 * only the source of the facts differs.
 *
 * `facts` must be shaped like the raw extraction the playbook normalises (for the
 * deposit playbook: { tenant, landlord, property, deposit, tenancy, protection,
 * landlordResponse, … }). The intake-schema endpoint is responsible for emitting
 * that shape.
 */

import type { CaseAssessment, CaseContext, Playbook } from "./core/types.ts";
import { getPlaybook } from "./playbooks/registry.ts";

export interface FactsAssessment extends CaseAssessment {
  domain: string;
  /** The validated, typed domain case the assessment was computed from. */
  extractedCase: unknown;
  /** Non-fatal normalisation notes (e.g. a coerced date, an ignored field). */
  warnings: string[];
}

export interface AssessFromFactsOptions {
  domain?: string;
  context?: CaseContext;
  /** Override the playbook directly (otherwise resolved from `domain`). */
  playbook?: Playbook<any>;
}

export function assessFromFacts(
  facts: Record<string, unknown>,
  options: AssessFromFactsOptions = {},
): FactsAssessment {
  const playbook = options.playbook ?? getPlaybook(options.domain);
  const warnings: string[] = [];

  // Reuse the playbook's own validator — same coercion + required-field checks
  // as the VLM path. There are no documents on this path, so pass an empty list.
  const domainCase = playbook.normalize(
    facts,
    { documents: [], domain: options.domain, context: options.context },
    warnings,
  );

  const assessment = playbook.assess(domainCase);
  return { ...assessment, domain: playbook.id, extractedCase: domainCase, warnings };
}
