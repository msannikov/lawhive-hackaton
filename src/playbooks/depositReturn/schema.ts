/**
 * The extraction schema, expressed once and adapted for each provider:
 *  - `tenantCaseJsonSchema`  → Claude tool `input_schema` (JSON Schema)
 *  - `tenantCaseGeminiSchema` → Gemini `responseSchema`
 *
 * It mirrors `TenantCase` plus an `evidence[]` array so the model cites where
 * each fact came from. The model's job is to REPORT what the documents say —
 * never to decide the legal outcome.
 */

import { SchemaType, type Schema } from "@google/generative-ai";

export const EXTRACTION_INSTRUCTIONS = `
You are a paralegal extracting facts from a UK tenant's deposit-return documents
(tenancy agreement, bank statement, and screenshots of the three deposit-scheme
"is my deposit protected?" searches: DPS, mydeposits, TDS).

Rules:
- Report ONLY what the documents state. Do NOT decide the legal outcome.
- deposit.paidDate = the date the landlord RECEIVED the deposit (the bank
  statement payment to the landlord), in YYYY-MM-DD.
- For each scheme screenshot, set schemeSearches[].found=false when it shows
  "no record / no match found"; true only if a protected record is shown.
- protection.protectedInScheme = true only if at least one search found a record.
- protection.prescribedInformationGiven = false if the Schedule 1 prescribed-
  information scheme/ADR fields are blank or "to be confirmed".
- Use null for anything not stated in the documents.
- For each important field, add an evidence entry citing the source document.
`.trim();

/** JSON Schema for Anthropic tool use (Claude). */
export const tenantCaseJsonSchema = {
  type: "object",
  properties: {
    tenant: party(),
    landlord: party(),
    property: {
      type: "object",
      properties: { address: { type: "string" }, postcode: { type: "string" } },
      required: ["address", "postcode"],
    },
    deposit: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Deposit amount in GBP, e.g. 980.77" },
        currency: { type: "string", enum: ["GBP"] },
        paidDate: { type: "string", description: "YYYY-MM-DD the landlord received the deposit" },
      },
      required: ["amount", "currency", "paidDate"],
    },
    tenancy: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "YYYY-MM-DD" },
        endDate: { type: ["string", "null"], description: "YYYY-MM-DD or null" },
        ended: { type: "boolean" },
      },
      required: ["startDate", "ended"],
    },
    protection: {
      type: "object",
      properties: {
        protectedInScheme: { type: "boolean" },
        scheme: { type: ["string", "null"], enum: ["DPS", "mydeposits", "TDS", null] },
        dateProtected: { type: ["string", "null"] },
        prescribedInformationGiven: { type: "boolean" },
        schemeSearches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              scheme: { type: "string", enum: ["DPS", "mydeposits", "TDS"] },
              searched: { type: "boolean" },
              found: { type: "boolean" },
              reference: { type: ["string", "null"] },
            },
            required: ["scheme", "searched", "found"],
          },
        },
      },
      required: ["protectedInScheme", "prescribedInformationGiven"],
    },
    landlordResponse: {
      type: "string",
      enum: ["agrees_in_full", "disputes_deductions", "silent", "unknown"],
    },
    forwardingAddressProvided: { type: ["boolean", "null"] },
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
  required: ["tenant", "landlord", "property", "deposit", "tenancy", "protection"],
} as const;

function party() {
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
const gParty: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    name: { type: SchemaType.STRING },
    email: { type: SchemaType.STRING, nullable: true },
    phone: { type: SchemaType.STRING, nullable: true },
    address: { type: SchemaType.STRING, nullable: true },
  },
  required: ["name"],
};

export const tenantCaseGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    tenant: gParty,
    landlord: gParty,
    property: {
      type: SchemaType.OBJECT,
      properties: {
        address: { type: SchemaType.STRING },
        postcode: { type: SchemaType.STRING },
      },
      required: ["address", "postcode"],
    },
    deposit: {
      type: SchemaType.OBJECT,
      properties: {
        amount: { type: SchemaType.NUMBER },
        currency: { type: SchemaType.STRING },
        paidDate: { type: SchemaType.STRING },
      },
      required: ["amount", "currency", "paidDate"],
    },
    tenancy: {
      type: SchemaType.OBJECT,
      properties: {
        startDate: { type: SchemaType.STRING },
        endDate: { type: SchemaType.STRING, nullable: true },
        ended: { type: SchemaType.BOOLEAN },
      },
      required: ["startDate", "ended"],
    },
    protection: {
      type: SchemaType.OBJECT,
      properties: {
        protectedInScheme: { type: SchemaType.BOOLEAN },
        scheme: { type: SchemaType.STRING, nullable: true },
        dateProtected: { type: SchemaType.STRING, nullable: true },
        prescribedInformationGiven: { type: SchemaType.BOOLEAN },
        schemeSearches: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              scheme: { type: SchemaType.STRING },
              searched: { type: SchemaType.BOOLEAN },
              found: { type: SchemaType.BOOLEAN },
              reference: { type: SchemaType.STRING, nullable: true },
            },
            required: ["scheme", "searched", "found"],
          },
        },
      },
      required: ["protectedInScheme", "prescribedInformationGiven"],
    },
    landlordResponse: { type: SchemaType.STRING, nullable: true },
    forwardingAddressProvided: { type: SchemaType.BOOLEAN, nullable: true },
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
  required: ["tenant", "landlord", "property", "deposit", "tenancy", "protection"],
};
