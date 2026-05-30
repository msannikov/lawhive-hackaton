/**
 * The extraction schema, expressed once and adapted for each provider:
 *  - `flightDelayJsonSchema`   → Claude tool `input_schema` (JSON Schema)
 *  - `flightDelayGeminiSchema` → Gemini `responseSchema`
 *
 * It mirrors `FlightDelayCase` plus an `evidence[]` array so the model cites
 * where each fact came from. The model's job is to REPORT what the documents say
 * (boarding pass, booking confirmation, flight-tracker screenshots, the
 * airline's acknowledgment/rejection emails) — never to decide eligibility.
 */

import { SchemaType, type Schema } from "@google/generative-ai";

export const EXTRACTION_INSTRUCTIONS = `
You are a paralegal extracting facts from a UK air passenger's flight-disruption
documents (boarding pass, booking confirmation, flight-tracker / FlightAware
screenshots, and any airline acknowledgment or rejection emails) for a claim
under UK Regulation (EC) 261/2004 ("UK261").

Rules:
- Report ONLY what the documents state. Do NOT decide whether compensation is owed.
- flight.airline = the OPERATING carrier (who actually flew the aircraft), not a
  ticket agent or codeshare marketing carrier.
- flight.date = the scheduled date of the flight, in YYYY-MM-DD.
- flight.distanceKm = the great-circle journey distance in km if a tracker states
  it (e.g. "1,438 km"); otherwise null.
- timings.* = HH:MM 24-hour. timings.arrivalDelayHours = how late the flight
  ARRIVED at the destination, in whole hours (round down). If a tracker says
  "arrived 5h 54m late", arrivalDelayHours = 5.
- disruption.type: "delay" | "cancellation" | "denied_boarding" | "unknown".
- disruption.reasonGiven = the airline's stated reason verbatim if given.
- disruption.extraordinaryClaimed = true only if the airline expressly relies on
  "extraordinary circumstances" (or clearly equivalent wording) to refuse.
- disruption.reasonCategory: weather | atc | strike | technical | other — your
  best read of the stated reason (e.g. "EUROCONTROL flow restrictions" → atc;
  "crew sickness / aircraft technical issue" → technical).
- cancellationNoticeDays = days' notice before the scheduled date, if a
  cancellation notice is shown; otherwise null.
- claimStatus: "not_submitted" | "submitted" | "acknowledged" | "rejected" |
  "unknown". Set "acknowledged" if an airline email confirms receipt of a claim,
  "rejected" if an email refuses it.
- ukOrEuRoute = true if the flight departed a UK airport, or a UK/EU carrier
  arrived at a UK airport.
- Use null for anything not stated in the documents.
- For each important field, add an evidence entry citing the source document.
`.trim();

/** JSON Schema for Anthropic tool use (Claude). */
export const flightDelayJsonSchema = {
  type: "object",
  properties: {
    passenger: passenger(),
    flight: {
      type: "object",
      properties: {
        airline: { type: "string", description: "Operating carrier, e.g. StratAIR" },
        flightNumber: { type: "string", description: "e.g. ST3214" },
        date: { type: "string", description: "YYYY-MM-DD scheduled date of the flight" },
        origin: { type: "string", description: "Origin airport, e.g. London Heathrow (LHR)" },
        destination: { type: "string", description: "Destination airport, e.g. Rome Fiumicino (FCO)" },
        distanceKm: { type: ["number", "null"], description: "Great-circle journey distance in km, or null" },
        ukOrEuRoute: { type: "boolean", description: "UK departure, or UK/EU carrier arriving in the UK" },
      },
      required: ["airline", "flightNumber", "date", "origin", "destination", "ukOrEuRoute"],
    },
    timings: {
      type: "object",
      properties: {
        scheduledDeparture: { type: ["string", "null"], description: "HH:MM" },
        actualDeparture: { type: ["string", "null"], description: "HH:MM" },
        scheduledArrival: { type: ["string", "null"], description: "HH:MM" },
        actualArrival: { type: ["string", "null"], description: "HH:MM" },
        arrivalDelayHours: { type: ["number", "null"], description: "Whole hours late on ARRIVAL" },
      },
    },
    disruption: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["delay", "cancellation", "denied_boarding", "unknown"] },
        reasonGiven: { type: ["string", "null"] },
        extraordinaryClaimed: { type: "boolean" },
        reasonCategory: {
          type: ["string", "null"],
          enum: ["weather", "atc", "strike", "technical", "other", null],
        },
      },
      required: ["type", "extraordinaryClaimed"],
    },
    cancellationNoticeDays: { type: ["number", "null"] },
    claimStatus: {
      type: "string",
      enum: ["not_submitted", "submitted", "acknowledged", "rejected", "unknown"],
    },
    claimSubmittedDate: { type: ["string", "null"], description: "YYYY-MM-DD or null" },
    evidence: {
      type: "array",
      description: "Citations: where each key fact was found.",
      items: {
        type: "object",
        properties: {
          field: { type: "string" },
          value: {},
          source: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["field", "source"],
      },
    },
  },
  required: ["passenger", "flight", "timings", "disruption"],
} as const;

function passenger() {
  return {
    type: "object",
    properties: {
      name: { type: "string" },
      email: { type: ["string", "null"] },
      phone: { type: ["string", "null"] },
      address: { type: ["string", "null"] },
    },
    required: ["name"],
  };
}

/* ------------------------------------------------------------------ *
 * Gemini responseSchema (same shape, SchemaType enums, nullable flags)
 * ------------------------------------------------------------------ */
const gPassenger: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    name: { type: SchemaType.STRING },
    email: { type: SchemaType.STRING, nullable: true },
    phone: { type: SchemaType.STRING, nullable: true },
    address: { type: SchemaType.STRING, nullable: true },
  },
  required: ["name"],
};

export const flightDelayGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    passenger: gPassenger,
    flight: {
      type: SchemaType.OBJECT,
      properties: {
        airline: { type: SchemaType.STRING },
        flightNumber: { type: SchemaType.STRING },
        date: { type: SchemaType.STRING },
        origin: { type: SchemaType.STRING },
        destination: { type: SchemaType.STRING },
        distanceKm: { type: SchemaType.NUMBER, nullable: true },
        ukOrEuRoute: { type: SchemaType.BOOLEAN },
      },
      required: ["airline", "flightNumber", "date", "origin", "destination", "ukOrEuRoute"],
    },
    timings: {
      type: SchemaType.OBJECT,
      properties: {
        scheduledDeparture: { type: SchemaType.STRING, nullable: true },
        actualDeparture: { type: SchemaType.STRING, nullable: true },
        scheduledArrival: { type: SchemaType.STRING, nullable: true },
        actualArrival: { type: SchemaType.STRING, nullable: true },
        arrivalDelayHours: { type: SchemaType.NUMBER, nullable: true },
      },
    },
    disruption: {
      type: SchemaType.OBJECT,
      properties: {
        type: { type: SchemaType.STRING },
        reasonGiven: { type: SchemaType.STRING, nullable: true },
        extraordinaryClaimed: { type: SchemaType.BOOLEAN },
        reasonCategory: { type: SchemaType.STRING, nullable: true },
      },
      required: ["type", "extraordinaryClaimed"],
    },
    cancellationNoticeDays: { type: SchemaType.NUMBER, nullable: true },
    claimStatus: { type: SchemaType.STRING, nullable: true },
    claimSubmittedDate: { type: SchemaType.STRING, nullable: true },
    evidence: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          field: { type: SchemaType.STRING },
          value: { type: SchemaType.STRING, nullable: true },
          source: { type: SchemaType.STRING },
          confidence: { type: SchemaType.NUMBER, nullable: true },
        },
        required: ["field", "source"],
      },
    },
  },
  required: ["passenger", "flight", "timings", "disruption"],
};
