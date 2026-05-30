/**
 * Serialises a CaseAssessment for the HTTP boundary.
 *
 * The engine keeps deadlines as `Date` objects (only `Tool.deadline` and
 * `nextMove.deadline`); everything else on the assessment is already a string.
 * We convert those two Dates to `YYYY-MM-DD` using the engine's own `toISO` so
 * the frontend receives stable calendar dates — NOT the implicit
 * `Date.toJSON()` UTC datetime, which can render a day early in some timezones.
 */
import { toISO } from "../../../src/core/dates.ts";
import type { CaseAssessment } from "../../../src/core/types.ts";

/** Anything assessFromFacts / evaluateCase returns (assessment + a little extra). */
type AssessmentLike = CaseAssessment & {
  domain?: string;
  extractedCase?: unknown;
  warnings?: string[];
};

export function serializeAssessment(a: AssessmentLike) {
  return {
    ...a,
    tools: a.tools.map((t) => ({ ...t, deadline: toISO(t.deadline) })),
    nextMove: a.nextMove ? { ...a.nextMove, deadline: toISO(a.nextMove.deadline) } : undefined,
  };
}
