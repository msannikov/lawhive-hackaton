/**
 * Turns raw model output into a trustworthy TenantCase. Schema-constrained
 * decoding gives the right SHAPE; this enforces the CONTRACT — coercing dates to
 * YYYY-MM-DD, applying caller context overrides, and failing loudly on missing
 * required facts so a bad extraction never produces a wrong deadline.
 */

import type { TenantCase, LandlordResponse } from "./case.ts";
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

/** Parses money that may arrive as 980.77, "980.77", "£980.77" or "1,980.77". */
export function coerceAmount(v: unknown, field: string): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[£$€,\s]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  throw new Error(`Unparseable amount for ${field}: ${JSON.stringify(v)}`);
}

const RESPONSES: LandlordResponse[] = [
  "agrees_in_full", "disputes_deductions", "silent", "unknown",
];

/**
 * Validates + normalises raw extraction into a TenantCase.
 * Caller `context` always wins over model-inferred values.
 */
export function normalizeTenantCase(
  raw: any,
  input: CaseInput,
  warnings: string[],
): TenantCase {
  if (!raw || typeof raw !== "object") throw new Error("Extraction returned no object");

  const req = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(`Extraction missing required field: ${msg}`);
  };
  req(raw.tenant?.name, "tenant.name");
  req(raw.landlord?.name, "landlord.name");
  req(raw.property?.address, "property.address");
  req(raw.deposit?.amount != null, "deposit.amount");

  const ctx = input.context ?? {};

  let landlordResponse: LandlordResponse = "unknown";
  const ctxResponse = ctx.landlordResponse as LandlordResponse | undefined;
  if (ctxResponse && RESPONSES.includes(ctxResponse)) {
    landlordResponse = ctxResponse;
  } else if (RESPONSES.includes(raw.landlordResponse)) {
    landlordResponse = raw.landlordResponse;
  } else if (raw.landlordResponse != null) {
    warnings.push(`Unknown landlordResponse "${raw.landlordResponse}" → "unknown".`);
  }

  const searches = Array.isArray(raw.protection?.schemeSearches)
    ? raw.protection.schemeSearches
        .filter((s: any) => ["DPS", "mydeposits", "TDS"].includes(s?.scheme))
        .map((s: any) => ({
          scheme: s.scheme,
          searched: !!s.searched,
          found: !!s.found,
          reference: s.reference ?? undefined,
        }))
    : undefined;

  const protectedInScheme = !!raw.protection?.protectedInScheme;
  if (searches?.length) {
    const anyFound = searches.some((s: any) => s.found);
    if (anyFound !== protectedInScheme) {
      warnings.push(
        `protectedInScheme=${protectedInScheme} disagrees with scheme searches ` +
          `(anyFound=${anyFound}); trusting the searches.`,
      );
    }
  }

  return {
    tenant: party(raw.tenant),
    landlord: party(raw.landlord),
    property: {
      address: String(raw.property.address),
      postcode: String(raw.property.postcode ?? "").trim(),
    },
    deposit: {
      amount: coerceAmount(raw.deposit.amount, "deposit.amount"),
      currency: "GBP",
      paidDate: coerceDate(raw.deposit.paidDate, "deposit.paidDate"),
    },
    tenancy: {
      startDate: coerceDate(raw.tenancy?.startDate, "tenancy.startDate"),
      endDate: coerceOptionalDate(raw.tenancy?.endDate, "tenancy.endDate", warnings) ?? undefined,
      ended: !!raw.tenancy?.ended,
    },
    protection: {
      protectedInScheme: searches?.length
        ? searches.some((s: any) => s.found)
        : protectedInScheme,
      scheme: raw.protection?.scheme ?? null,
      dateProtected: coerceOptionalDate(raw.protection?.dateProtected, "dateProtected", warnings),
      prescribedInformationGiven: !!raw.protection?.prescribedInformationGiven,
      schemeSearches: searches,
    },
    landlordResponse,
    forwardingAddressProvided:
      raw.forwardingAddressProvided == null ? undefined : !!raw.forwardingAddressProvided,
    depositRequestDate: ctx.depositRequestDate
      ? coerceDate(ctx.depositRequestDate, "context.depositRequestDate")
      : undefined,
    evaluationDate: ctx.evaluationDate
      ? coerceDate(ctx.evaluationDate, "context.evaluationDate")
      : undefined,
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
