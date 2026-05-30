/**
 * Deterministic rules-engine sub-package: the decision tree, deadline maths and
 * toolset builders. The public, document-driven entry point is the async
 * `evaluateCase` in src/evaluateCase.ts, which wraps `matchToolset` below.
 */

export * from "./types.ts";
export { matchToolset } from "./orchestrator.ts";
export { classify, BRANCH_LABELS } from "./decisionTree.ts";
export { computeKeyDates } from "./keyDates.ts";
export { buildToolsForBranch } from "./toolsArsenal.ts";
export * as dates from "./dates.ts";
