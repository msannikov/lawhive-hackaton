/**
 * Turns raw model output into a trustworthy ConsumerServicesCase.
 * Schema-constrained decoding gives the right SHAPE; this enforces the CONTRACT
 * — coercing dates to YYYY-MM-DD, parsing money, applying caller context
 * overrides, and failing loudly on missing required facts so a bad extraction
 * never produces a wrong deadline. Mirrors depositReturn/normalize.ts.
 */

import type {
  ConsumerServicesCase,
  DeliveryStatus,
  SupplierResponse,
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

/** Parses money that may arrive as 980.77, "980.77", "£980.77" or "1,980.77". */
export function coerceAmount(v: unknown, field: string): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[£$€,\s]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  throw new Error(`Unparseable amount for ${field}: ${JSON.stringify(v)}`);
}

const DELIVERY: DeliveryStatus[] = [
  "nothing_delivered", "defective_or_late", "delivered_ok", "unknown",
];
const RESPONSES: SupplierResponse[] = [
  "unresponsive", "engaging", "refusing", "unknown",
];

/**
 * Validates + normalises raw extraction into a ConsumerServicesCase.
 * Caller `context` always wins over model-inferred values.
 */
export function normalize(
  raw: any,
  input: CaseInput,
  warnings: string[],
): ConsumerServicesCase {
  if (!raw || typeof raw !== "object") throw new Error("Extraction returned no object");

  const req = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(`Extraction missing required field: ${msg}`);
  };
  req(raw.consumer?.name, "consumer.name");
  req(raw.supplier?.name, "supplier.name");
  req(raw.service?.serviceType, "service.serviceType");
  req(raw.payment?.totalPrice != null, "payment.totalPrice");
  req(raw.payment?.amountPaid != null, "payment.amountPaid");

  const ctx = input.context ?? {};

  // delivery: context override wins, else model value, else "unknown".
  let delivery: DeliveryStatus = "unknown";
  const ctxDelivery = ctx.delivery as DeliveryStatus | undefined;
  if (ctxDelivery && DELIVERY.includes(ctxDelivery)) {
    delivery = ctxDelivery;
  } else if (DELIVERY.includes(raw.delivery)) {
    delivery = raw.delivery;
  } else if (raw.delivery != null) {
    warnings.push(`Unknown delivery "${raw.delivery}" → "unknown".`);
  }

  // supplierResponse: context override wins, else model value, else "unknown".
  let supplierResponse: SupplierResponse = "unknown";
  const ctxResponse = ctx.supplierResponse as SupplierResponse | undefined;
  if (ctxResponse && RESPONSES.includes(ctxResponse)) {
    supplierResponse = ctxResponse;
  } else if (RESPONSES.includes(raw.supplierResponse)) {
    supplierResponse = raw.supplierResponse;
  } else if (raw.supplierResponse != null) {
    warnings.push(`Unknown supplierResponse "${raw.supplierResponse}" → "unknown".`);
  }

  const totalPrice = coerceAmount(raw.payment.totalPrice, "payment.totalPrice");
  const amountPaid = coerceAmount(raw.payment.amountPaid, "payment.amountPaid");
  if (amountPaid > totalPrice) {
    warnings.push(
      `amountPaid (£${amountPaid.toFixed(2)}) exceeds totalPrice (£${totalPrice.toFixed(2)}).`,
    );
  }

  return {
    consumer: party(raw.consumer),
    supplier: party(raw.supplier),
    service: {
      serviceType: String(raw.service.serviceType),
      bookingDate: coerceOptionalDate(raw.service?.bookingDate, "service.bookingDate", warnings),
      serviceDate: coerceOptionalDate(raw.service?.serviceDate, "service.serviceDate", warnings),
      whatWasDelivered: raw.service?.whatWasDelivered ?? undefined,
    },
    payment: {
      totalPrice,
      amountPaid,
      currency: "GBP",
      depositPaidDate: coerceOptionalDate(
        raw.payment?.depositPaidDate,
        "payment.depositPaidDate",
        warnings,
      ),
    },
    delivery,
    supplierResponse,
    complaintDate: ctx.complaintDate
      ? coerceDate(ctx.complaintDate, "context.complaintDate")
      : coerceOptionalDate(raw.complaintDate, "complaintDate", warnings),
    evaluationDate: ctx.evaluationDate
      ? coerceDate(ctx.evaluationDate, "context.evaluationDate")
      : undefined,
    negotiationStage:
      ctx.stage === "post_letter" || ctx.stage === "post_adr" ? ctx.stage : "initial",
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
