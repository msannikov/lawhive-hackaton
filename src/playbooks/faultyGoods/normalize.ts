/**
 * Turns raw model output into a trustworthy FaultyGoodsCase. Schema-constrained
 * decoding gives the right SHAPE; this enforces the CONTRACT — coercing dates to
 * YYYY-MM-DD and money to a number, applying caller context overrides, and
 * failing loudly on missing required facts so a bad extraction never produces a
 * wrong deadline (above all the 30-day right-to-reject window).
 */

import type {
  FaultyGoodsCase,
  DealerResponse,
  SellerType,
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

/** Parses money that may arrive as 8495, "8495.00", "£8,495.00" or "8,495". */
export function coerceAmount(v: unknown, field: string): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[£$€,\s]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  throw new Error(`Unparseable amount for ${field}: ${JSON.stringify(v)}`);
}

/** Parses a mileage that may arrive as 54000, "54000" or "54,000 miles". */
function coerceOptionalNumber(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[,\smiles]/gi, ""));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

const RESPONSES: DealerResponse[] = [
  "agrees_refund", "offers_repair", "repair_failed", "refuses", "silent", "unknown",
];

const SELLER_TYPES: SellerType[] = ["trader", "private", "unknown"];

/**
 * Validates + normalises raw extraction into a FaultyGoodsCase.
 * Caller `context` always wins over model-inferred values.
 */
export function normalizeFaultyGoodsCase(
  raw: any,
  input: CaseInput,
  warnings: string[],
): FaultyGoodsCase {
  if (!raw || typeof raw !== "object") throw new Error("Extraction returned no object");

  const req = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(`Extraction missing required field: ${msg}`);
  };
  req(raw.buyer?.name, "buyer.name");
  req(raw.seller?.name, "seller.name");
  req(raw.goods?.description, "goods.description");
  req(raw.purchase?.amount != null, "purchase.amount");
  req(raw.fault?.description, "fault.description");

  const ctx = input.context ?? {};

  // Seller type: context override > model > "unknown".
  let sellerType: SellerType = "unknown";
  const ctxSeller = ctx.sellerType as SellerType | undefined;
  if (ctxSeller && SELLER_TYPES.includes(ctxSeller)) {
    sellerType = ctxSeller;
  } else if (SELLER_TYPES.includes(raw.sellerType)) {
    sellerType = raw.sellerType;
  } else if (raw.sellerType != null) {
    warnings.push(`Unknown sellerType "${raw.sellerType}" → "unknown".`);
  }
  if (sellerType === "unknown") {
    warnings.push(
      "Seller type not established — CRA 2015 rights apply only against a TRADER; confirm the seller is a business.",
    );
  }

  // Dealer response: context override > model > "unknown".
  let dealerResponse: DealerResponse = "unknown";
  const ctxResponse = ctx.dealerResponse as DealerResponse | undefined;
  if (ctxResponse && RESPONSES.includes(ctxResponse)) {
    dealerResponse = ctxResponse;
  } else if (RESPONSES.includes(raw.dealerResponse)) {
    dealerResponse = raw.dealerResponse;
  } else if (raw.dealerResponse != null) {
    warnings.push(`Unknown dealerResponse "${raw.dealerResponse}" → "unknown".`);
  }

  // A failed repair (or context flag) implies a repair was attempted.
  const ctxRepairAttempted =
    ctx.repairAttempted === "true"
      ? true
      : ctx.repairAttempted === "false"
        ? false
        : undefined;
  const repairAttempted =
    ctxRepairAttempted ??
    (dealerResponse === "repair_failed"
      ? true
      : raw.repairAttempted == null
        ? undefined
        : !!raw.repairAttempted);

  const stage = ctx.stage;

  return {
    buyer: party(raw.buyer),
    seller: party(raw.seller),
    sellerType,
    goods: {
      description: String(raw.goods.description),
      identifier: raw.goods.identifier ?? undefined,
      mileageAtPurchase: coerceOptionalNumber(raw.goods.mileageAtPurchase),
    },
    purchase: {
      amount: coerceAmount(raw.purchase.amount, "purchase.amount"),
      currency: "GBP",
      purchaseDate: coerceDate(
        ctx.purchaseDate ?? raw.purchase.purchaseDate,
        "purchase.purchaseDate",
      ),
    },
    fault: {
      description: String(raw.fault.description),
      diagnosticFinding: raw.fault.diagnosticFinding ?? undefined,
      dateAppeared:
        coerceOptionalDate(
          ctx.faultAppearedDate ?? raw.fault.dateAppeared,
          "fault.dateAppeared",
          warnings,
        ) ?? undefined,
    },
    dealerResponse,
    repairAttempted,
    evaluationDate: ctx.evaluationDate
      ? coerceDate(ctx.evaluationDate, "context.evaluationDate")
      : undefined,
    negotiationStage:
      stage === "post_letter" || stage === "post_lbc" || stage === "post_adr"
        ? stage
        : "initial",
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
