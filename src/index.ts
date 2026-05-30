/**
 * Public API of the deposit-return system.
 *
 * Input is unstructured documents; output is the matched toolset.
 *
 *   import { evaluateCase, loadDocuments } from "./src/index.ts";
 *
 *   const documents = await loadDocuments([
 *     "sample_data/tenancy_agreement.pdf",
 *     "sample_data/bank_statement_deposit_payment.pdf",
 *     "sample_data/dps_search_result.png",
 *     "sample_data/mydeposits_search_result.png",
 *     "sample_data/tds_search_result.png",
 *   ]);
 *
 *   const assessment = await evaluateCase({ documents });
 *   for (const tool of assessment.tools) {
 *     console.log(tool.nextAction, "by", tool.deadline);
 *   }
 */

// Public entry point (async, VLM-backed).
export { evaluateCase, type EvaluateOptions } from "./evaluateCase.ts";

// Extraction layer (providers, loaders, schema).
export * from "./extraction/index.ts";

// Deterministic rules engine (the auditable core).
export { matchToolset } from "./toolset/orchestrator.ts";
export * from "./toolset/types.ts";
export { classify, BRANCH_LABELS } from "./toolset/decisionTree.ts";
export { computeKeyDates } from "./toolset/keyDates.ts";
export { buildToolsForBranch } from "./toolset/toolsArsenal.ts";
export * as dates from "./toolset/dates.ts";
