/**
 * Turns raw model output into a trustworthy UnpaidWagesCase. Schema-constrained
 * decoding gives the right SHAPE; this enforces the CONTRACT — coercing dates to
 * YYYY-MM-DD, coercing money, applying caller context overrides, and failing
 * loudly on missing required facts so a bad extraction never produces a wrong
 * deadline (the ET limit is unforgiving: 3 months less 1 day from the deduction).
 */

import type {
  UnpaidWagesCase,
  UnpaidItem,
  EmployerResponse,
} from "./case.ts";
import type { CaseInput } from "../../core/types.ts";

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** Accepts YYYY-MM-DD, DD/MM/YYYY, or "13 April 2026"; returns ISO or throws. */
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

/** Parses money that may arrive as 2800, "2800", "£2,800.00" or "£5,333.85". */
export function coerceAmount(v: unknown, field: string): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[£$€,\s]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  throw new Error(`Unparseable amount for ${field}: ${JSON.stringify(v)}`);
}

const RESPONSES: EmployerResponse[] = [
  "pays_in_full", "disputes", "silent", "engaging", "unknown",
];

const ITEM_KINDS: UnpaidItem["kind"][] = ["salary", "commission", "holiday", "other"];

function party(p: any) {
  return {
    name: String(p.name),
    email: p.email ?? undefined,
    phone: p.phone ?? undefined,
    address: p.address ?? undefined,
  };
}

/**
 * Validates + normalises raw extraction into an UnpaidWagesCase.
 * Caller `context` always wins over model-inferred values.
 */
export function normalizeUnpaidWagesCase(
  raw: any,
  input: CaseInput,
  warnings: string[],
): UnpaidWagesCase {
  if (!raw || typeof raw !== "object") throw new Error("Extraction returned no object");

  const req = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(`Extraction missing required field: ${msg}`);
  };
  req(raw.employee?.name, "employee.name");
  req(raw.employer?.name, "employer.name");

  const ctx = input.context ?? {};

  // --- unpaid items -------------------------------------------------------
  const items: UnpaidItem[] = Array.isArray(raw.unpaidItems)
    ? raw.unpaidItems
        .filter((it: any) => it && it.label != null && it.amount != null)
        .map((it: any): UnpaidItem => {
          const kind: UnpaidItem["kind"] = ITEM_KINDS.includes(it.kind) ? it.kind : "other";
          if (it.kind && !ITEM_KINDS.includes(it.kind)) {
            warnings.push(`Unknown unpaid-item kind "${it.kind}" → "other".`);
          }
          return {
            label: String(it.label),
            amount: coerceAmount(it.amount, `unpaidItems[${it.label}].amount`),
            currency: "GBP",
            kind,
          };
        })
    : [];
  req(items.length > 0, "unpaidItems (at least one)");

  const itemsTotal = items.reduce((sum, it) => sum + it.amount, 0);
  let amountUnpaid: number;
  if (raw.amountUnpaid != null) {
    amountUnpaid = coerceAmount(raw.amountUnpaid, "amountUnpaid");
    // Sanity-check the stated total against the summed items.
    if (items.length && Math.abs(amountUnpaid - itemsTotal) > 0.5) {
      warnings.push(
        `amountUnpaid=${amountUnpaid} disagrees with summed items (${itemsTotal.toFixed(2)}); ` +
          "trusting the stated total.",
      );
    }
  } else {
    amountUnpaid = itemsTotal;
  }

  // --- employer response (context wins) -----------------------------------
  let employerResponse: EmployerResponse = "unknown";
  const ctxResponse = ctx.employerResponse as EmployerResponse | undefined;
  if (ctxResponse && RESPONSES.includes(ctxResponse)) {
    employerResponse = ctxResponse;
  } else if (RESPONSES.includes(raw.employerResponse)) {
    employerResponse = raw.employerResponse;
  } else if (raw.employerResponse != null) {
    warnings.push(`Unknown employerResponse "${raw.employerResponse}" → "unknown".`);
  }

  // --- commission ---------------------------------------------------------
  const commissionItem = items.find((it) => it.kind === "commission");
  const commissionClaimed = !!raw.commission?.claimed || !!commissionItem;
  const commission = {
    claimed: commissionClaimed,
    amount:
      raw.commission?.amount != null
        ? coerceAmount(raw.commission.amount, "commission.amount")
        : commissionItem?.amount,
    confirmedInWriting:
      raw.commission?.confirmedInWriting == null ? undefined : !!raw.commission.confirmedInWriting,
    confirmedBy: raw.commission?.confirmedBy ?? undefined,
    confirmedDate: coerceOptionalDate(raw.commission?.confirmedDate, "commission.confirmedDate", warnings)
      ?? undefined,
  };

  // --- deduction date (context wins; required) ----------------------------
  const deductionDate = ctx.deductionDate
    ? coerceDate(ctx.deductionDate, "context.deductionDate")
    : coerceDate(raw.deductionDate, "deductionDate");

  const negotiationStage =
    ctx.stage === "post_grievance" || ctx.stage === "post_acas" ? ctx.stage : "initial";

  return {
    employee: party(raw.employee),
    employer: party(raw.employer),
    role: String(ctx.role ?? raw.role ?? "employee"),
    basicSalaryAnnual:
      raw.basicSalaryAnnual != null
        ? coerceAmount(raw.basicSalaryAnnual, "basicSalaryAnnual")
        : undefined,
    payDateDescription: raw.payDateDescription ?? undefined,
    unpaidItems: items,
    amountUnpaid,
    currency: "GBP",
    commission,
    deductionDate,
    hrContacted: ctx.hrContacted != null ? ctx.hrContacted === "true" : !!raw.hrContacted,
    hrFirstContactDate:
      coerceOptionalDate(ctx.hrFirstContactDate ?? raw.hrFirstContactDate, "hrFirstContactDate", warnings)
      ?? undefined,
    hrResponded: ctx.hrResponded != null ? ctx.hrResponded === "true" : !!raw.hrResponded,
    employerResponse,
    grievanceRaised:
      ctx.grievanceRaised != null
        ? ctx.grievanceRaised === "true"
        : raw.grievanceRaised == null
          ? undefined
          : !!raw.grievanceRaised,
    evaluationDate: ctx.evaluationDate
      ? coerceDate(ctx.evaluationDate, "context.evaluationDate")
      : undefined,
    negotiationStage,
  };
}
