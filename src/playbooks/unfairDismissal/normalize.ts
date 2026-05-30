/**
 * Turns raw model output into a trustworthy UnfairDismissalCase. Schema-
 * constrained decoding gives the right SHAPE; this enforces the CONTRACT —
 * coercing dates to YYYY-MM-DD, parsing money, applying caller context
 * overrides, and failing loudly on missing required facts so a bad extraction
 * never produces a wrong tribunal deadline.
 */

import type {
  UnfairDismissalCase,
  DismissalReason,
  DiscriminationGround,
  ProcessOutcome,
  SettlementVehicle,
  InternalProcess,
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

function coerceOptionalDate(v: unknown, field: string, warnings: string[]): string | undefined {
  if (v == null || v === "") return undefined;
  try {
    return coerceDate(v, field);
  } catch (e) {
    warnings.push((e as Error).message);
    return undefined;
  }
}

/** Parses money that may arrive as 4450, "4,450", "£4,450" or "£4,450.00". */
export function coerceAmount(v: unknown, field: string, warnings: string[]): number | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[£$€,\s]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  warnings.push(`Unparseable amount for ${field}: ${JSON.stringify(v)}`);
  return undefined;
}

const DISMISSAL_REASONS: DismissalReason[] = [
  "redundancy", "conduct", "capability", "some_other_substantial_reason", "other",
];
const GROUNDS: DiscriminationGround[] = [
  "sex", "pregnancy_maternity", "race", "disability", "age",
  "religion_belief", "sexual_orientation", "gender_reassignment",
  "marriage_civil_partnership", "other",
];
const OUTCOMES: ProcessOutcome[] = ["upheld", "not_upheld", "pending", "unknown"];
const VEHICLES: SettlementVehicle[] = ["cot3", "settlement_agreement", "unknown"];

function normalizeProcess(raw: any, field: string, warnings: string[]): InternalProcess {
  const raised = !!raw?.raised;
  let outcome: ProcessOutcome | undefined;
  if (raw?.outcome != null) {
    outcome = OUTCOMES.includes(raw.outcome) ? raw.outcome : "unknown";
    if (outcome === "unknown" && raw.outcome !== "unknown") {
      warnings.push(`Unknown ${field}.outcome "${raw.outcome}" → "unknown".`);
    }
  }
  return {
    raised,
    raisedDate: coerceOptionalDate(raw?.raisedDate, `${field}.raisedDate`, warnings),
    outcomeDate: coerceOptionalDate(raw?.outcomeDate, `${field}.outcomeDate`, warnings),
    outcome,
  };
}

/**
 * Validates + normalises raw extraction into an UnfairDismissalCase.
 * Caller `context` always wins over model-inferred values.
 */
export function normalizeUnfairDismissalCase(
  raw: any,
  input: CaseInput,
  warnings: string[],
): UnfairDismissalCase {
  if (!raw || typeof raw !== "object") throw new Error("Extraction returned no object");

  const req = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(`Extraction missing required field: ${msg}`);
  };
  req(raw.employee?.name, "employee.name");
  req(raw.employer?.name, "employer.name");
  req(raw.employment?.startDate, "employment.startDate");

  const ctx = input.context ?? {};

  // --- dismissal reason (context override → model → "other") ---
  let reason: DismissalReason = "other";
  const ctxReason = ctx.dismissalReason as DismissalReason | undefined;
  if (ctxReason && DISMISSAL_REASONS.includes(ctxReason)) {
    reason = ctxReason;
  } else if (DISMISSAL_REASONS.includes(raw.dismissal?.reason)) {
    reason = raw.dismissal.reason;
  } else if (raw.dismissal?.reason != null) {
    warnings.push(`Unknown dismissal.reason "${raw.dismissal.reason}" → "other".`);
  }

  // --- discrimination ---
  const discriminationAlleged =
    ctx.discriminationAlleged != null
      ? ctx.discriminationAlleged === "true"
      : !!raw.discrimination?.alleged;
  let ground: DiscriminationGround | undefined;
  const ctxGround = ctx.discriminationGround as DiscriminationGround | undefined;
  if (ctxGround && GROUNDS.includes(ctxGround)) {
    ground = ctxGround;
  } else if (raw.discrimination?.ground && GROUNDS.includes(raw.discrimination.ground)) {
    ground = raw.discrimination.ground;
  } else if (raw.discrimination?.ground != null) {
    warnings.push(`Unknown discrimination.ground "${raw.discrimination.ground}" → omitted.`);
  }

  // --- settlement vehicle ---
  let vehicle: SettlementVehicle | undefined;
  if (raw.settlement?.vehicle != null) {
    vehicle = VEHICLES.includes(raw.settlement.vehicle) ? raw.settlement.vehicle : "unknown";
    if (vehicle === "unknown" && raw.settlement.vehicle !== "unknown") {
      warnings.push(`Unknown settlement.vehicle "${raw.settlement.vehicle}" → "unknown".`);
    }
  }

  // --- ACAS EC: notification (Day A) must not be after certificate (Day B) ---
  const acasNotification = ctx.acasNotificationDate
    ? coerceDate(ctx.acasNotificationDate, "context.acasNotificationDate")
    : coerceOptionalDate(raw.acas?.notificationDate, "acas.notificationDate", warnings);
  const acasCertificate = ctx.acasCertificateDate
    ? coerceDate(ctx.acasCertificateDate, "context.acasCertificateDate")
    : coerceOptionalDate(raw.acas?.certificateDate, "acas.certificateDate", warnings);
  if (acasNotification && acasCertificate && acasNotification > acasCertificate) {
    warnings.push(
      `ACAS Day A (${acasNotification}) is after Day B (${acasCertificate}); ` +
        "stop-the-clock extension will be treated as zero.",
    );
  }

  return {
    employee: party(raw.employee),
    employer: party(raw.employer),
    employment: {
      startDate: coerceDate(raw.employment.startDate, "employment.startDate"),
      endDate:
        (ctx.endDate ? coerceDate(ctx.endDate, "context.endDate") : undefined) ??
        coerceOptionalDate(raw.employment?.endDate, "employment.endDate", warnings),
      jobTitle: raw.employment?.jobTitle ?? undefined,
    },
    dismissal: {
      reason,
      reasonGiven: raw.dismissal?.reasonGiven ?? undefined,
      noticeDate: coerceOptionalDate(raw.dismissal?.noticeDate, "dismissal.noticeDate", warnings),
    },
    discrimination: {
      alleged: discriminationAlleged,
      ground,
      facts: raw.discrimination?.facts ?? undefined,
      protectedActDone:
        raw.discrimination?.protectedActDone == null
          ? undefined
          : !!raw.discrimination.protectedActDone,
    },
    grievance: normalizeProcess(raw.grievance, "grievance", warnings),
    appeal: normalizeProcess(raw.appeal, "appeal", warnings),
    acas: {
      completed:
        ctx.acasCompleted != null ? ctx.acasCompleted === "true" : !!raw.acas?.completed,
      notificationDate: acasNotification,
      certificateDate: acasCertificate,
      certificateNumber: raw.acas?.certificateNumber ?? undefined,
    },
    settlement: {
      offered:
        ctx.settlementOffered != null
          ? ctx.settlementOffered === "true"
          : !!raw.settlement?.offered,
      amount: coerceAmount(
        ctx.settlementAmount ?? raw.settlement?.amount,
        "settlement.amount",
        warnings,
      ),
      currency: "GBP",
      offerDate: coerceOptionalDate(raw.settlement?.offerDate, "settlement.offerDate", warnings),
      acceptByDate: ctx.settlementAcceptByDate
        ? coerceDate(ctx.settlementAcceptByDate, "context.settlementAcceptByDate")
        : coerceOptionalDate(raw.settlement?.acceptByDate, "settlement.acceptByDate", warnings),
      vehicle,
    },
    pay: {
      annualGross: coerceAmount(raw.pay?.annualGross, "pay.annualGross", warnings),
      monthlyGross: coerceAmount(raw.pay?.monthlyGross, "pay.monthlyGross", warnings),
      monthlyNet: coerceAmount(raw.pay?.monthlyNet, "pay.monthlyNet", warnings),
      currency: "GBP",
    },
    evaluationDate: ctx.evaluationDate
      ? coerceDate(ctx.evaluationDate, "context.evaluationDate")
      : undefined,
    negotiationStage:
      ctx.stage === "post_acas" || ctx.stage === "post_et1" ? ctx.stage : "initial",
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
