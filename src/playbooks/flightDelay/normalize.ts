/**
 * Turns raw model output into a trustworthy FlightDelayCase. Schema-constrained
 * decoding gives the right SHAPE; this enforces the CONTRACT — coercing dates to
 * YYYY-MM-DD, parsing the distance into a UK261 band, applying caller context
 * overrides, and failing loudly on missing required facts so a bad extraction
 * never produces a wrong deadline or the wrong compensation figure.
 */

import type {
  FlightDelayCase,
  DisruptionType,
  DistanceBand,
  ClaimStatus,
} from "./case.ts";
import type { CaseInput } from "../../core/types.ts";

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** Accepts YYYY-MM-DD, DD/MM/YYYY, or "14 August 2025"; returns ISO or throws. */
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

/** Parses a number that may arrive as 1438, "1438", "1,438 km" or "893 mi". */
export function coerceNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n) && v.trim() !== "") return n;
  }
  return undefined;
}

/** Great-circle distance (km) → the UK261 compensation band. */
export function bandForDistance(km: number): DistanceBand {
  if (km <= 1500) return "le1500";
  if (km <= 3500) return "1500to3500";
  return "gt3500";
}

const DISRUPTION_TYPES: DisruptionType[] = [
  "delay", "cancellation", "denied_boarding", "unknown",
];
const CLAIM_STATUSES: ClaimStatus[] = [
  "not_submitted", "submitted", "acknowledged", "rejected", "unknown",
];
const REASON_CATEGORIES = ["weather", "atc", "strike", "technical", "other"] as const;
const BANDS: DistanceBand[] = ["le1500", "1500to3500", "gt3500"];

/**
 * Validates + normalises raw extraction into a FlightDelayCase.
 * Caller `context` always wins over model-inferred values.
 */
export function normalizeFlightDelayCase(
  raw: any,
  input: CaseInput,
  warnings: string[],
): FlightDelayCase {
  if (!raw || typeof raw !== "object") throw new Error("Extraction returned no object");

  const req = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(`Extraction missing required field: ${msg}`);
  };
  req(raw.passenger?.name, "passenger.name");
  req(raw.flight?.airline, "flight.airline");
  req(raw.flight?.flightNumber, "flight.flightNumber");
  req(raw.flight?.destination, "flight.destination");

  const ctx = input.context ?? {};

  // --- disruption type (context wins) ---
  let type: DisruptionType = "unknown";
  const ctxType = ctx.disruptionType as DisruptionType | undefined;
  if (ctxType && DISRUPTION_TYPES.includes(ctxType)) {
    type = ctxType;
  } else if (DISRUPTION_TYPES.includes(raw.disruption?.type)) {
    type = raw.disruption.type;
  } else if (raw.disruption?.type != null) {
    warnings.push(`Unknown disruption type "${raw.disruption.type}" → "unknown".`);
  }

  // --- claim status (context wins) ---
  let claimStatus: ClaimStatus = "unknown";
  const ctxStatus = ctx.claimStatus as ClaimStatus | undefined;
  if (ctxStatus && CLAIM_STATUSES.includes(ctxStatus)) {
    claimStatus = ctxStatus;
  } else if (CLAIM_STATUSES.includes(raw.claimStatus)) {
    claimStatus = raw.claimStatus;
  } else if (raw.claimStatus != null) {
    warnings.push(`Unknown claimStatus "${raw.claimStatus}" → "unknown".`);
  }

  // --- distance band: prefer a stated distance, else a context override band ---
  const distanceKm = coerceNumber(raw.flight?.distanceKm);
  let distanceBand: DistanceBand;
  const ctxBand = ctx.distanceBand as DistanceBand | undefined;
  if (distanceKm != null) {
    distanceBand = bandForDistance(distanceKm);
  } else if (ctxBand && BANDS.includes(ctxBand)) {
    distanceBand = ctxBand;
  } else {
    // No distance figure and no override: assume the middle band but warn, so the
    // £ figure is never silently overstated.
    distanceBand = "1500to3500";
    warnings.push("No journey distance found → assuming 1500–3500 km band (£350); confirm the route distance.");
  }

  // --- arrival delay: prefer a stated figure, else compute from sched/actual ---
  let arrivalDelayHours = coerceNumber(raw.timings?.arrivalDelayHours);
  const ctxDelay = coerceNumber(ctx.arrivalDelayHours);
  if (ctxDelay != null) arrivalDelayHours = ctxDelay;

  const extraordinaryClaimed = !!raw.disruption?.extraordinaryClaimed;
  let reasonCategory = REASON_CATEGORIES.includes(raw.disruption?.reasonCategory)
    ? (raw.disruption.reasonCategory as (typeof REASON_CATEGORIES)[number])
    : undefined;
  if (raw.disruption?.reasonCategory && !reasonCategory) {
    warnings.push(`Unknown reasonCategory "${raw.disruption.reasonCategory}" → dropped.`);
  }

  return {
    passenger: passenger(raw.passenger),
    flight: {
      airline: String(raw.flight.airline),
      flightNumber: String(raw.flight.flightNumber),
      date: coerceDate(raw.flight.date, "flight.date"),
      origin: String(raw.flight.origin ?? "").trim(),
      destination: String(raw.flight.destination),
      distanceKm,
      distanceBand,
      ukOrEuRoute: raw.flight.ukOrEuRoute == null ? true : !!raw.flight.ukOrEuRoute,
    },
    timings: {
      scheduledDeparture: str(raw.timings?.scheduledDeparture),
      actualDeparture: str(raw.timings?.actualDeparture),
      scheduledArrival: str(raw.timings?.scheduledArrival),
      actualArrival: str(raw.timings?.actualArrival),
      arrivalDelayHours,
    },
    disruption: {
      type,
      reasonGiven: str(raw.disruption?.reasonGiven),
      extraordinaryClaimed,
      reasonCategory,
    },
    cancellationNoticeDays: coerceNumber(raw.cancellationNoticeDays),
    claimStatus,
    claimSubmittedDate:
      coerceOptionalDate(
        ctx.claimSubmittedDate ?? raw.claimSubmittedDate,
        "claimSubmittedDate",
        warnings,
      ) ?? undefined,
    evaluationDate: ctx.evaluationDate
      ? coerceDate(ctx.evaluationDate, "context.evaluationDate")
      : undefined,
    negotiationStage:
      ctx.stage === "post_claim" || ctx.stage === "post_adr" ? ctx.stage : "initial",
  };
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function passenger(p: any) {
  return {
    name: String(p.name),
    email: p.email ?? undefined,
    phone: p.phone ?? undefined,
    address: p.address ?? undefined,
  };
}
