/**
 * Turns raw model output into a trustworthy HousingDisrepairCase.
 * Schema-constrained decoding gives the right SHAPE; this enforces the
 * CONTRACT — coercing dates to YYYY-MM-DD, applying caller context overrides,
 * and failing loudly on missing required facts so a bad extraction never
 * produces a wrong deadline.
 */

import type {
  HousingDisrepairCase,
  ReportMethod,
  LandlordType,
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

const REPORT_METHODS: ReportMethod[] = [
  "phone", "email", "letter", "in_person", "portal", "unknown",
];
const LANDLORD_TYPES: LandlordType[] = [
  "council", "housing_association", "private", "unknown",
];

function coerceRooms(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && !!x.trim())
    .map((x) => x.trim());
}

/**
 * Validates + normalises raw extraction into a HousingDisrepairCase.
 * Caller `context` always wins over model-inferred values.
 */
export function normalizeHousingDisrepairCase(
  raw: any,
  input: CaseInput,
  warnings: string[],
): HousingDisrepairCase {
  if (!raw || typeof raw !== "object") throw new Error("Extraction returned no object");

  const req = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(`Extraction missing required field: ${msg}`);
  };
  req(raw.tenant?.name, "tenant.name");
  req(raw.landlord?.name, "landlord.name");
  req(raw.property?.address, "property.address");
  req(raw.disrepair?.description, "disrepair.description");
  req(raw.disrepair?.firstReportedDate, "disrepair.firstReportedDate");

  const ctx = input.context ?? {};

  let landlordType: LandlordType = "unknown";
  const ctxType = ctx.landlordType as LandlordType | undefined;
  if (ctxType && LANDLORD_TYPES.includes(ctxType)) {
    landlordType = ctxType;
  } else if (LANDLORD_TYPES.includes(raw.tenancy?.landlordType)) {
    landlordType = raw.tenancy.landlordType;
  } else if (raw.tenancy?.landlordType != null) {
    warnings.push(`Unknown landlordType "${raw.tenancy.landlordType}" → "unknown".`);
  }

  let reportMethod: ReportMethod = "unknown";
  if (REPORT_METHODS.includes(raw.disrepair?.reportMethod)) {
    reportMethod = raw.disrepair.reportMethod;
  } else if (raw.disrepair?.reportMethod != null) {
    warnings.push(`Unknown reportMethod "${raw.disrepair.reportMethod}" → "unknown".`);
  }

  return {
    tenant: party(raw.tenant),
    landlord: party(raw.landlord),
    property: {
      address: String(raw.property.address),
      postcode: String(raw.property.postcode ?? "").trim(),
    },
    tenancy: {
      startDate: coerceDate(raw.tenancy?.startDate, "tenancy.startDate"),
      landlordType,
    },
    disrepair: {
      description: String(raw.disrepair.description),
      roomsAffected: coerceRooms(raw.disrepair?.roomsAffected),
      firstReportedDate: coerceDate(raw.disrepair.firstReportedDate, "disrepair.firstReportedDate"),
      reportMethod,
      // Default ongoing=true: only treat as resolved if the model explicitly says so.
      ongoing: raw.disrepair?.ongoing == null ? true : !!raw.disrepair.ongoing,
    },
    landlordAction: {
      acknowledged: !!raw.landlordAction?.acknowledged,
      worksScheduled: !!raw.landlordAction?.worksScheduled,
      worksCompleted: !!raw.landlordAction?.worksCompleted,
      recurredAfterWorks: !!raw.landlordAction?.recurredAfterWorks,
      lastActionDate:
        coerceOptionalDate(raw.landlordAction?.lastActionDate, "landlordAction.lastActionDate", warnings) ??
        undefined,
    },
    inspection: {
      inspected: !!raw.inspection?.inspected,
      inspectionDate:
        coerceOptionalDate(raw.inspection?.inspectionDate, "inspection.inspectionDate", warnings) ??
        undefined,
      findingsSummary: raw.inspection?.findingsSummary ?? undefined,
      hhsrsCategory1:
        raw.inspection?.hhsrsCategory1 == null ? undefined : !!raw.inspection.hhsrsCategory1,
    },
    health: {
      healthImpactReported: !!raw.health?.healthImpactReported,
      gpLetterProvided: !!raw.health?.gpLetterProvided,
      vulnerableOccupant: !!raw.health?.vulnerableOccupant,
      gpLetterDate:
        coerceOptionalDate(raw.health?.gpLetterDate, "health.gpLetterDate", warnings) ?? undefined,
      summary: raw.health?.summary ?? undefined,
    },
    evaluationDate: ctx.evaluationDate
      ? coerceDate(ctx.evaluationDate, "context.evaluationDate")
      : undefined,
    negotiationStage:
      ctx.stage === "post_letter_of_claim" || ctx.stage === "post_protocol"
        ? ctx.stage
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
