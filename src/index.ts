/**
 * Public API.
 *
 * Input is unstructured documents; output is a domain-specific toolset.
 *
 *   import { evaluateCase, loadDocumentsFromDir } from "./src/index.ts";
 *
 *   const documents = await loadDocumentsFromDir("sample_data");
 *   const assessment = await evaluateCase({ documents });        // default domain
 *   // or: evaluateCase({ documents, domain: "employment_termination" })
 *
 *   for (const tool of assessment.tools) {
 *     console.log(tool.nextAction, "by", tool.deadline);
 *   }
 */

// Public entry point (async, VLM-backed, domain-agnostic).
export { evaluateCase, type EvaluateOptions } from "./evaluateCase.ts";

// Core types and the playbook seam.
export * from "./core/types.ts";
export * as dates from "./core/dates.ts";

// Extraction layer (providers, loaders, default selection).
export {
  ClaudeProvider,
  GeminiProvider,
  MockProvider,
  defaultProvider,
  loadDocuments,
  loadDocumentsFromDir,
  documentFromFile,
  documentFromBuffer,
} from "./extraction/index.ts";

// Playbook registry + the bundled domains.
export {
  PLAYBOOKS,
  DEFAULT_DOMAIN,
  getPlaybook,
  depositReturnPlaybook,
  employmentTerminationPlaybook,
} from "./playbooks/registry.ts";
