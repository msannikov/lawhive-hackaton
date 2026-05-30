/**
 * Employment-termination playbook (stub).
 *
 * Deliberately minimal — its job is to prove the {@link Playbook} seam: a second
 * legal domain plugs in with its own extraction schema, validation, branch logic
 * and tools, while the orchestrator, providers and core types are untouched.
 *
 * Legal note: simplified for the hackathon (England & Wales). Real advice needs
 * continuity-of-employment rules, automatic-unfair grounds, etc.
 */

import type {
  Playbook,
  CaseAssessment,
  CaseInput,
  Tool,
  EscalationSignal,
} from "../../core/types.ts";
import type { EmploymentCase, EmploymentBranch, TerminationType } from "./case.ts";
import {
  employmentJsonSchema,
  employmentGeminiSchema,
  EXTRACTION_INSTRUCTIONS,
} from "./schema.ts";
import { parseISO, addMonths, addCalendarDays, addYears, formatUK, isAfter } from "../../core/dates.ts";
import { buildNextMove } from "../../core/negotiation.ts";

const TERMINATION_TYPES: TerminationType[] = ["dismissal", "redundancy", "resignation", "other"];

function coerceDate(v: unknown): string | undefined {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : undefined;
}

function normalize(raw: any, input: CaseInput, warnings: string[]): EmploymentCase {
  if (!raw?.employee?.name) throw new Error("Extraction missing required field: employee.name");
  if (!raw?.employer?.name) throw new Error("Extraction missing required field: employer.name");

  const type: TerminationType = TERMINATION_TYPES.includes(raw?.termination?.type)
    ? raw.termination.type
    : "other";
  if (raw?.termination?.type && type === "other" && raw.termination.type !== "other") {
    warnings.push(`Unknown termination type "${raw.termination.type}" → "other".`);
  }

  return {
    employee: { name: String(raw.employee.name) },
    employer: { name: String(raw.employer.name) },
    employment: {
      startDate: coerceDate(raw?.employment?.startDate),
      endDate: coerceDate(raw?.employment?.endDate),
      jobTitle: raw?.employment?.jobTitle ?? undefined,
    },
    termination: {
      type,
      reasonGiven: raw?.termination?.reasonGiven ?? undefined,
      noticeGiven: raw?.termination?.noticeGiven == null ? undefined : !!raw.termination.noticeGiven,
    },
    evaluationDate: input.context?.evaluationDate,
  };
}

const BRANCH_LABELS: Record<EmploymentBranch, string> = {
  UNFAIR_DISMISSAL_POSSIBLE: "Possible unfair dismissal claim",
  LIMITED_QUALIFYING_RIGHTS: "Under 2 years' service → limited rights",
  REVIEW_NEEDED: "Facts incomplete → review needed",
};

function assess(c: EmploymentCase): CaseAssessment {
  const reasoning: string[] = [];
  const evalDate = c.evaluationDate ? parseISO(c.evaluationDate) : new Date();

  const end = c.employment.endDate ? parseISO(c.employment.endDate) : undefined;
  const start = c.employment.startDate ? parseISO(c.employment.startDate) : undefined;

  // ACAS Early Conciliation must be started before the ET limit: effective date
  // of termination + 3 months less 1 day.
  const etLimit = end ? addCalendarDays(addMonths(end, 3), -1) : addCalendarDays(addMonths(evalDate, 3), -1);

  // Unfair dismissal generally needs 2 years' continuous service.
  const qualifies = !!(start && end && isAfter(end, addYears(start, 2)));

  let branch: EmploymentBranch;
  if (!end || !start) {
    branch = "REVIEW_NEEDED";
    reasoning.push("Employment start/end dates not both found → cannot assess qualifying service.");
  } else if (c.termination.type === "dismissal" && qualifies) {
    branch = "UNFAIR_DISMISSAL_POSSIBLE";
    reasoning.push("Dismissal with 2+ years' service → possible unfair dismissal claim.");
  } else if (qualifies) {
    branch = "UNFAIR_DISMISSAL_POSSIBLE";
    reasoning.push(`${c.termination.type} with 2+ years' service → review for a tribunal claim.`);
  } else {
    branch = "LIMITED_QUALIFYING_RIGHTS";
    reasoning.push("Under 2 years' service → limited unfair-dismissal rights (notice/pay may still apply).");
  }

  const tools: Tool[] = [
    {
      id: "gather-evidence",
      title: "Assemble employment evidence",
      category: "evidence",
      priority: 1,
      deadline: addCalendarDays(evalDate, 5),
      deadlineBasis: "Do first — needed for grievance and any tribunal claim.",
      nextAction:
        "Collect the employment contract, the dismissal/redundancy letter, recent payslips and " +
        "any relevant emails about the termination.",
    },
    {
      id: "raise-grievance",
      title: "Raise a written grievance",
      category: "letter",
      priority: 2,
      deadline: addCalendarDays(evalDate, 14),
      deadlineBasis: "Raise promptly while events are fresh and before tribunal deadlines tighten.",
      legalBasis: "ACAS Code of Practice on Disciplinary and Grievance Procedures",
      nextAction:
        `Write to ${c.employer.name} setting out why you believe the ${c.termination.type} was unfair ` +
        "and what outcome you want.",
    },
    {
      id: "acas-early-conciliation",
      title: "Start ACAS Early Conciliation",
      category: "adr",
      priority: 3,
      deadline: etLimit,
      deadlineBasis: `Mandatory before a tribunal claim; effective termination + 3 months less 1 day (${formatUK(etLimit)}).`,
      legalBasis: "Employment Tribunals Act 1996; mandatory ACAS Early Conciliation",
      nextAction:
        "Notify ACAS to begin Early Conciliation. This is a free, mandatory step before any " +
        "Employment Tribunal claim and pauses the clock while it runs.",
    },
  ];

  const escalation: EscalationSignal =
    branch === "REVIEW_NEEDED"
      ? {
          level: "escalate",
          recommend: true,
          reason:
            "Key employment dates are missing — a human should review before acting, as tribunal deadlines are strict.",
          triggers: ["incomplete_facts"],
        }
      : branch === "UNFAIR_DISMISSAL_POSSIBLE"
        ? {
            level: "monitor",
            recommend: false,
            reason:
              "Start ACAS Early Conciliation yourself, but get a lawyer to review before lodging an ET1 — tribunal claims are complex and strictly time-limited.",
            triggers: ["watch:before_et1", "complex_claim"],
          }
        : {
            level: "self_serve",
            recommend: false,
            reason:
              "Under 2 years' service limits unfair-dismissal rights; check notice and holiday pay yourself. Escalate only if discrimination or automatic-unfair grounds apply.",
            triggers: ["watch:discrimination_grounds"],
          };

  const nextMove = buildNextMove(tools, escalation.recommend);

  const summary =
    `Matched branch "${BRANCH_LABELS[branch]}" (${escalation.level}) with ${tools.length} tool(s). ` +
    `ACAS/ET deadline: ${formatUK(etLimit)}.`;

  return {
    branch,
    branchLabel: BRANCH_LABELS[branch],
    summary,
    reasoning,
    keyDates: {
      "Termination date": end ? formatUK(end) : "unknown",
      "ACAS / ET deadline": formatUK(etLimit),
    },
    tools,
    nextMove,
    escalation,
  };
}

export const employmentTerminationPlaybook: Playbook<EmploymentCase> = {
  id: "employment_termination",
  label: "UK employment termination (stub)",
  extraction: {
    instructions: EXTRACTION_INSTRUCTIONS,
    jsonSchema: employmentJsonSchema as unknown as Record<string, unknown>,
    geminiSchema: employmentGeminiSchema,
  },
  normalize,
  assess,
};
