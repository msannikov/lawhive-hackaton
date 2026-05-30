/**
 * Turns raw model output into a trustworthy SmallClaimsNuisanceCase.
 * Schema-constrained decoding gives the right SHAPE; this enforces the CONTRACT —
 * coercing dates to YYYY-MM-DD and money to numbers, applying caller context
 * overrides, and failing loudly on missing required facts so a bad extraction
 * never produces a wrong procedural deadline (these are strict and unforgiving).
 */

import type {
  SmallClaimsNuisanceCase,
  DirectionsDeadline,
  JudgmentInfo,
  SjeStatus,
} from "./case.ts";
import type { CaseInput } from "../../core/types.ts";

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** Accepts YYYY-MM-DD, DD/MM/YYYY, or "13 April 2024"; returns ISO or throws. */
export function coerceDate(v: unknown, field: string): string {
  if (typeof v !== "string" || !v.trim()) throw new Error(`Missing date: ${field}`);
  const s = v.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }

  const words = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (words) {
    const [, d, mon, y] = words;
    const m = MONTHS[mon!.toLowerCase()];
    if (m) return `${y}-${String(m).padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }
  throw new Error(`Unparseable date for ${field}: "${s}"`);
}

function coerceOptionalDate(v: unknown, field: string, warnings: string[]): string | null {
  if (v == null || v === "") return null;
  try {
    return coerceDate(v, field);
  } catch (e) {
    warnings.push((e as Error).message);
    return null;
  }
}

/** Parses money that may arrive as 4200, "4200", "£4,200" or "4,200.00". */
export function coerceAmount(v: unknown, field: string): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[£$€,\s]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  throw new Error(`Unparseable amount for ${field}: ${JSON.stringify(v)}`);
}

const SJE_STATES: SjeStatus[] = [
  "proposed", "agreed", "obtained", "declined", "not_applicable", "unknown",
];

const JUDGMENT_BASES: JudgmentInfo["basis"][] = [
  "default", "non_attendance", "on_merits", "unknown",
];

/**
 * Validates + normalises raw extraction into a SmallClaimsNuisanceCase.
 * Caller `context` always wins over model-inferred values.
 */
export function normalizeSmallClaimsNuisanceCase(
  raw: any,
  input: CaseInput,
  warnings: string[],
): SmallClaimsNuisanceCase {
  if (!raw || typeof raw !== "object") throw new Error("Extraction returned no object");

  const req = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(`Extraction missing required field: ${msg}`);
  };
  req(raw.claimant?.name, "claimant.name");
  req(raw.defendant?.name, "defendant.name");
  req(raw.caseNumber, "caseNumber");
  req(raw.nuisance?.remedialCost != null, "nuisance.remedialCost");

  const ctx = input.context ?? {};

  // Directions deadlines: keep only well-formed, date-coercible entries.
  const deadlines: DirectionsDeadline[] = Array.isArray(raw.directions?.deadlines)
    ? raw.directions.deadlines
        .map((d: any) => {
          const date = coerceOptionalDate(d?.date, `directions.deadline "${d?.step}"`, warnings);
          return d?.step && date ? { step: String(d.step), date } : null;
        })
        .filter((d: DirectionsDeadline | null): d is DirectionsDeadline => d !== null)
    : [];

  // SJE: context override wins, then model value, else "unknown".
  let sje: SjeStatus = "unknown";
  const ctxSje = ctx.sje as SjeStatus | undefined;
  if (ctxSje && SJE_STATES.includes(ctxSje)) {
    sje = ctxSje;
  } else if (SJE_STATES.includes(raw.sje)) {
    sje = raw.sje;
  } else if (raw.sje != null) {
    warnings.push(`Unknown sje "${raw.sje}" → "unknown".`);
  }

  // Missed deadline: prefer the explicit object, else allow a context override.
  let missedDeadline: SmallClaimsNuisanceCase["missedDeadline"];
  if (raw.missedDeadline?.step && raw.missedDeadline?.dueDate) {
    missedDeadline = {
      step: String(raw.missedDeadline.step),
      dueDate: coerceDate(raw.missedDeadline.dueDate, "missedDeadline.dueDate"),
      documentFiled:
        raw.missedDeadline.documentFiled == null ? undefined : !!raw.missedDeadline.documentFiled,
    };
  }
  if (ctx.missedDeadlineStep && ctx.missedDeadlineDate) {
    missedDeadline = {
      step: ctx.missedDeadlineStep,
      dueDate: coerceDate(ctx.missedDeadlineDate, "context.missedDeadlineDate"),
      documentFiled: ctx.documentFiled === "true" ? true : missedDeadline?.documentFiled,
    };
  }

  // Judgment: prefer the explicit object, else allow a context override.
  let judgment: JudgmentInfo | undefined;
  if (raw.judgment?.date) {
    const basis: JudgmentInfo["basis"] = JUDGMENT_BASES.includes(raw.judgment.basis)
      ? raw.judgment.basis
      : "unknown";
    if (raw.judgment.basis && !JUDGMENT_BASES.includes(raw.judgment.basis)) {
      warnings.push(`Unknown judgment.basis "${raw.judgment.basis}" → "unknown".`);
    }
    judgment = {
      date: coerceDate(raw.judgment.date, "judgment.date"),
      basis,
      outcome: raw.judgment.outcome ?? undefined,
      permissionToAppealRefused:
        raw.judgment.permissionToAppealRefused == null
          ? undefined
          : !!raw.judgment.permissionToAppealRefused,
    };
  }
  if (ctx.judgmentDate) {
    const ctxBasis = ctx.judgmentBasis as JudgmentInfo["basis"] | undefined;
    judgment = {
      date: coerceDate(ctx.judgmentDate, "context.judgmentDate"),
      basis: ctxBasis && JUDGMENT_BASES.includes(ctxBasis) ? ctxBasis : judgment?.basis ?? "unknown",
      outcome: ctx.judgmentOutcome ?? judgment?.outcome,
      permissionToAppealRefused:
        ctx.permissionToAppealRefused === "true" ? true : judgment?.permissionToAppealRefused,
    };
  }

  return {
    claimant: party(raw.claimant),
    defendant: party(raw.defendant),
    court: String(raw.court ?? ctx.court ?? "").trim() || "the County Court",
    caseNumber: String(raw.caseNumber),
    nuisance: {
      description: String(raw.nuisance?.description ?? "tree-root encroachment causing property damage"),
      remedialCost: coerceAmount(raw.nuisance.remedialCost, "nuisance.remedialCost"),
      currency: "GBP",
      remedialCostSource: raw.nuisance?.remedialCostSource ?? undefined,
    },
    directions: {
      orderDate: coerceOptionalDate(raw.directions?.orderDate, "directions.orderDate", warnings) ?? undefined,
      deadlines,
      finalHearingDate:
        coerceOptionalDate(raw.directions?.finalHearingDate, "directions.finalHearingDate", warnings) ?? undefined,
    },
    missedDeadline,
    judgment,
    sje,
    evaluationDate: ctx.evaluationDate
      ? coerceDate(ctx.evaluationDate, "context.evaluationDate")
      : undefined,
    negotiationStage:
      ctx.stage === "post_application" || ctx.stage === "post_ruling" ? ctx.stage : "initial",
  };
}

function party(p: any) {
  return {
    name: String(p.name),
    email: p.email ?? undefined,
    phone: p.phone ?? undefined,
    address: p.address ?? undefined,
    representative: p.representative ?? undefined,
  };
}
