/**
 * Turns raw model output into a trustworthy UnfairTermsCase. Schema-constrained
 * decoding gives the right SHAPE; this enforces the CONTRACT — coercing dates to
 * YYYY-MM-DD and money to numbers, applying caller context overrides, and
 * failing loudly on missing required facts so a bad extraction never produces a
 * wrong deadline.
 */

import type {
  UnfairTermsCase,
  ChallengedTermType,
  CancellationReason,
  GymResponse,
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

/** Parses money that may arrive as 44.99, "44.99", "£44.99" or "1,044.99". */
export function coerceAmount(v: unknown, field: string): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[£$€,\s]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  throw new Error(`Unparseable amount for ${field}: ${JSON.stringify(v)}`);
}

/** Parses an integer month count from a number or string like "12 months". */
function coerceMonths(v: unknown, field: string): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string") {
    const m = v.match(/\d+/);
    if (m) return Number(m[0]);
  }
  throw new Error(`Unparseable month count for ${field}: ${JSON.stringify(v)}`);
}

const TERM_TYPES: ChallengedTermType[] = [
  "minimum_term", "auto_renewal", "cancellation_charge", "other",
];
const REASONS: CancellationReason[] = [
  "job_loss", "relocation", "injury_or_illness", "financial_hardship", "other", "unknown",
];
const RESPONSES: GymResponse[] = [
  "refused", "offered_reduction", "agreed_to_waive", "silent", "unknown",
];

/** Picks an enum value, preferring caller context, then the model, else a fallback. */
function pickEnum<T extends string>(
  allowed: T[],
  ctxValue: unknown,
  rawValue: unknown,
  fallback: T,
  label: string,
  warnings: string[],
): T {
  if (typeof ctxValue === "string" && allowed.includes(ctxValue as T)) return ctxValue as T;
  if (typeof rawValue === "string" && allowed.includes(rawValue as T)) return rawValue as T;
  if (rawValue != null) warnings.push(`Unknown ${label} "${rawValue}" → "${fallback}".`);
  return fallback;
}

/**
 * Validates + normalises raw extraction into an UnfairTermsCase.
 * Caller `context` always wins over model-inferred values.
 */
export function normalizeUnfairTermsCase(
  raw: any,
  input: CaseInput,
  warnings: string[],
): UnfairTermsCase {
  if (!raw || typeof raw !== "object") throw new Error("Extraction returned no object");

  const req = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(`Extraction missing required field: ${msg}`);
  };
  req(raw.consumer?.name, "consumer.name");
  req(raw.business?.name, "business.name");
  req(raw.membership?.minimumTermMonths != null, "membership.minimumTermMonths");
  req(raw.membership?.monthlyFee != null, "membership.monthlyFee");
  req(raw.debt?.amount != null, "debt.amount");
  req(raw.debt?.collectorName, "debt.collectorName");

  const ctx = input.context ?? {};

  const termType = pickEnum(
    TERM_TYPES, ctx.challengedTermType, raw.challengedTerm?.type, "other",
    "challengedTerm.type", warnings,
  );
  const cancellationReason = pickEnum(
    REASONS, ctx.cancellationReason, raw.cancellationReason, "unknown",
    "cancellationReason", warnings,
  );
  const gymResponse = pickEnum(
    RESPONSES, ctx.gymResponse, raw.gymResponse, "unknown",
    "gymResponse", warnings,
  );

  return {
    consumer: party(raw.consumer),
    business: party(raw.business),
    membership: {
      startDate: coerceDate(raw.membership?.startDate, "membership.startDate"),
      minimumTermMonths: coerceMonths(raw.membership.minimumTermMonths, "membership.minimumTermMonths"),
      monthlyFee: coerceAmount(raw.membership.monthlyFee, "membership.monthlyFee"),
      currency: "GBP",
      autoRenews: !!raw.membership?.autoRenews,
    },
    challengedTerm: {
      type: termType,
      description: String(raw.challengedTerm?.description ?? "").trim(),
      // CRA fairness defaults: assume NOT transparent / NOT prominent unless the
      // documents affirmatively show otherwise (protects the consumer's case).
      transparent: raw.challengedTerm?.transparent === true,
      prominent: raw.challengedTerm?.prominent === true,
    },
    cancellationReason,
    cancellationAttemptDate: ctx.cancellationAttemptDate
      ? coerceDate(ctx.cancellationAttemptDate, "context.cancellationAttemptDate")
      : coerceOptionalDate(raw.cancellationAttemptDate, "cancellationAttemptDate", warnings) ?? undefined,
    gymResponse,
    debt: {
      amount: coerceAmount(raw.debt.amount, "debt.amount"),
      currency: "GBP",
      collectorName: String(raw.debt.collectorName),
      letterDate:
        coerceOptionalDate(raw.debt?.letterDate, "debt.letterDate", warnings) ?? undefined,
      disputed:
        ctx.debtDisputed != null
          ? ctx.debtDisputed === "true"
          : raw.debt?.disputed == null
            ? undefined
            : !!raw.debt.disputed,
      aggressive: raw.debt?.aggressive == null ? undefined : !!raw.debt.aggressive,
    },
    evaluationDate: ctx.evaluationDate
      ? coerceDate(ctx.evaluationDate, "context.evaluationDate")
      : undefined,
    negotiationStage:
      ctx.stage === "post_dispute" || ctx.stage === "post_complaint" ? ctx.stage : "initial",
  };
}

function party(p: any) {
  return {
    name: String(p.name),
    email: p.email ?? undefined,
    phone: p.phone ?? undefined,
    address: p.address ?? undefined,
  };
}
