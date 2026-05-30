/**
 * Turns raw model output into a trustworthy BuildingDisputeCase.
 * Schema-constrained decoding gives the right SHAPE; this enforces the CONTRACT —
 * coercing dates to YYYY-MM-DD and money to numbers, applying caller context
 * overrides, and failing loudly on missing required facts so a bad extraction
 * never produces a wrong deadline or a wrong loss figure.
 */

import type {
  BuildingDisputeCase,
  ContractorResponse,
  CustomerType,
  Payment,
  RemedialCost,
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

/** Parses money that may arrive as 8000, "8000", "£8,000.00" or "1,980.77". */
export function coerceAmount(v: unknown, field: string): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[£$€,\s]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  throw new Error(`Unparseable amount for ${field}: ${JSON.stringify(v)}`);
}

const RESPONSES: ContractorResponse[] = [
  "abandoned", "disputes_liability", "threatening", "negotiating", "silent", "unknown",
];

/**
 * Validates + normalises raw extraction into a BuildingDisputeCase.
 * Caller `context` always wins over model-inferred values.
 */
export function normalizeBuildingDisputeCase(
  raw: any,
  input: CaseInput,
  warnings: string[],
): BuildingDisputeCase {
  if (!raw || typeof raw !== "object") throw new Error("Extraction returned no object");

  const req = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(`Extraction missing required field: ${msg}`);
  };
  req(raw.customer?.name, "customer.name");
  req(raw.contractor?.name, "contractor.name");
  req(raw.property?.address, "property.address");
  req(raw.contract?.scopeOfWorks, "contract.scopeOfWorks");

  const ctx = input.context ?? {};

  // Payments (the amounts paid to the contractor). Skip malformed rows loudly.
  const payments: Payment[] = Array.isArray(raw.payments)
    ? raw.payments
        .map((p: any, i: number): Payment | null => {
          try {
            return {
              amount: coerceAmount(p?.amount, `payments[${i}].amount`),
              date: coerceDate(p?.date, `payments[${i}].date`),
              reference: p?.reference ?? undefined,
            };
          } catch (e) {
            warnings.push((e as Error).message);
            return null;
          }
        })
        .filter((p: Payment | null): p is Payment => p !== null)
    : [];
  if (!payments.length) warnings.push("No payments to the contractor were extracted.");

  // Remedial / completion costs (the loss). Skip malformed rows loudly.
  const remedialCosts: RemedialCost[] = Array.isArray(raw.remedialCosts)
    ? raw.remedialCosts
        .map((r: any, i: number): RemedialCost | null => {
          try {
            const kind: RemedialCost["kind"] = r?.kind === "invoice" ? "invoice" : "quote";
            return {
              source: String(r?.source ?? "remedial contractor"),
              amount: coerceAmount(r?.amount, `remedialCosts[${i}].amount`),
              kind,
              date: coerceOptionalDate(r?.date, `remedialCosts[${i}].date`, warnings) ?? undefined,
              reference: r?.reference ?? undefined,
            };
          } catch (e) {
            warnings.push((e as Error).message);
            return null;
          }
        })
        .filter((r: RemedialCost | null): r is RemedialCost => r !== null)
    : [];
  if (!remedialCosts.length)
    warnings.push("No remedial/completion costs were extracted — the loss is unquantified.");

  let contractorResponse: ContractorResponse = "unknown";
  const ctxResponse = ctx.contractorResponse as ContractorResponse | undefined;
  if (ctxResponse && RESPONSES.includes(ctxResponse)) {
    contractorResponse = ctxResponse;
  } else if (RESPONSES.includes(raw.contractorResponse)) {
    contractorResponse = raw.contractorResponse;
  } else if (raw.contractorResponse != null) {
    warnings.push(`Unknown contractorResponse "${raw.contractorResponse}" → "unknown".`);
  }

  // Threatening conduct can be signalled directly or implied by the response.
  const threateningConduct =
    raw.threateningConduct == null
      ? contractorResponse === "threatening"
      : !!raw.threateningConduct;
  if (threateningConduct && contractorResponse !== "threatening") {
    warnings.push("Threatening conduct flagged; treating contractor response as threatening.");
    contractorResponse = "threatening";
  }

  const customerType: CustomerType =
    (ctx.customerType as CustomerType) === "business" || raw.customerType === "business"
      ? "business"
      : "consumer";

  return {
    customer: party(raw.customer),
    contractor: party(raw.contractor),
    property: {
      address: String(raw.property.address),
      postcode: String(raw.property.postcode ?? "").trim(),
    },
    customerType,
    contract: {
      scopeOfWorks: String(raw.contract.scopeOfWorks),
      agreedPrice:
        raw.contract?.agreedPrice == null
          ? undefined
          : coerceAmount(raw.contract.agreedPrice, "contract.agreedPrice"),
      currency: "GBP",
      agreedDate: coerceOptionalDate(raw.contract?.agreedDate, "contract.agreedDate", warnings) ?? undefined,
    },
    payments,
    defects: String(raw.defects ?? "").trim(),
    remedialCosts,
    contractorResponse,
    threateningConduct,
    breachDate: ctx.breachDate
      ? coerceDate(ctx.breachDate, "context.breachDate")
      : coerceOptionalDate(raw.breachDate, "breachDate", warnings) ?? undefined,
    evaluationDate: ctx.evaluationDate
      ? coerceDate(ctx.evaluationDate, "context.evaluationDate")
      : undefined,
    negotiationStage:
      ctx.stage === "post_letter" || ctx.stage === "post_lbc" ? ctx.stage : "initial",
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
