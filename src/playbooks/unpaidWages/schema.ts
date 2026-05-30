/**
 * The extraction schema, expressed once and adapted for each provider:
 *  - `unpaidWagesJsonSchema`   → Claude tool `input_schema` (JSON Schema)
 *  - `unpaidWagesGeminiSchema` → Gemini `responseSchema`
 *
 * It mirrors `UnpaidWagesCase` plus an `evidence[]` array so the model cites
 * where each fact came from. The model's job is to REPORT what the documents
 * say (the employment contract, the commission-confirmation email, the emails
 * to HR and HR's reply, the message to the manager) — never to decide the legal
 * outcome.
 */

import { SchemaType, type Schema } from "@google/generative-ai";

export const EXTRACTION_INSTRUCTIONS = `
You are a paralegal extracting facts from a UK employee's unpaid-wages documents
(employment contract incl. commission scheme rules, a commission-confirmation
email, the employee's emails to HR, HR's reply, and a message to the manager).

Rules:
- Report ONLY what the documents state. Do NOT decide the legal outcome.
- unpaidItems[] = every sum the employee says is owed and unpaid, each with a
  label (e.g. "March 2026 salary"), amount, currency GBP, and kind
  (salary | commission | holiday | other).
- amountUnpaid = the total gross sum claimed (sum the items if no total stated).
- commission.confirmedInWriting = true only if a manager/authorised person
  confirmed the commission as payable in writing (e.g. the confirmation email).
  Record commission.confirmedBy (name) and commission.confirmedDate (YYYY-MM-DD)
  if stated.
- deductionDate = the pay date on which the wages were DUE but not paid, in
  YYYY-MM-DD. If there is a series of non-payments, use the LAST/most recent
  date money was due. This is the date the deduction took effect.
- employerResponse: pays_in_full | disputes | silent | engaging | unknown.
  Use "silent" for a mere acknowledgement with no substantive answer or payment.
- hrContacted/hrResponded reflect whether the employee wrote to HR and whether
  HR replied at all.
- grievanceRaised = true only if a document is an explicit formal grievance
  under the employer's grievance procedure / ACAS Code.
- Use null for anything not stated in the documents.
- For each important field, add an evidence entry citing the source document.
`.trim();

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

/** JSON Schema for Anthropic tool use (Claude). */
export const unpaidWagesJsonSchema = {
  type: "object",
  properties: {
    employee: party(),
    employer: party(),
    role: { type: ["string", "null"], description: "Employee's job title" },
    basicSalaryAnnual: {
      type: ["number", "null"],
      description: "Basic gross salary per annum, e.g. 33600",
    },
    payDateDescription: {
      type: ["string", "null"],
      description: 'When wages were due, e.g. "28th of each month / final pay 13 April 2026"',
    },
    unpaidItems: {
      type: "array",
      description: "Each sum the employee says is owed and unpaid.",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: 'e.g. "March 2026 salary"' },
          amount: { type: "number", description: "Gross amount in GBP" },
          currency: { type: "string", enum: ["GBP"] },
          kind: { type: "string", enum: ["salary", "commission", "holiday", "other"] },
        },
        required: ["label", "amount", "kind"],
      },
    },
    amountUnpaid: {
      type: ["number", "null"],
      description: "Total gross sum claimed (sum of items if no total stated)",
    },
    commission: {
      type: "object",
      properties: {
        claimed: { type: "boolean", description: "Is commission part of the unpaid sum?" },
        amount: { type: ["number", "null"] },
        confirmedInWriting: { type: ["boolean", "null"] },
        confirmedBy: { type: ["string", "null"], description: "Who confirmed it" },
        confirmedDate: { type: ["string", "null"], description: "YYYY-MM-DD" },
      },
      required: ["claimed"],
    },
    deductionDate: {
      type: "string",
      description: "YYYY-MM-DD the wages were due but unpaid (last in a series)",
    },
    hrContacted: { type: "boolean" },
    hrFirstContactDate: { type: ["string", "null"], description: "YYYY-MM-DD" },
    hrResponded: { type: "boolean" },
    employerResponse: {
      type: "string",
      enum: ["pays_in_full", "disputes", "silent", "engaging", "unknown"],
    },
    grievanceRaised: { type: ["boolean", "null"] },
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
  required: ["employee", "employer", "unpaidItems", "commission", "deductionDate"],
} as const;

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

export const unpaidWagesGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    employee: gParty,
    employer: gParty,
    role: { type: SchemaType.STRING, nullable: true },
    basicSalaryAnnual: { type: SchemaType.NUMBER, nullable: true },
    payDateDescription: { type: SchemaType.STRING, nullable: true },
    unpaidItems: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          label: { type: SchemaType.STRING },
          amount: { type: SchemaType.NUMBER },
          currency: { type: SchemaType.STRING, nullable: true },
          kind: { type: SchemaType.STRING },
        },
        required: ["label", "amount", "kind"],
      },
    },
    amountUnpaid: { type: SchemaType.NUMBER, nullable: true },
    commission: {
      type: SchemaType.OBJECT,
      properties: {
        claimed: { type: SchemaType.BOOLEAN },
        amount: { type: SchemaType.NUMBER, nullable: true },
        confirmedInWriting: { type: SchemaType.BOOLEAN, nullable: true },
        confirmedBy: { type: SchemaType.STRING, nullable: true },
        confirmedDate: { type: SchemaType.STRING, nullable: true },
      },
      required: ["claimed"],
    },
    deductionDate: { type: SchemaType.STRING },
    hrContacted: { type: SchemaType.BOOLEAN, nullable: true },
    hrFirstContactDate: { type: SchemaType.STRING, nullable: true },
    hrResponded: { type: SchemaType.BOOLEAN, nullable: true },
    employerResponse: { type: SchemaType.STRING, nullable: true },
    grievanceRaised: { type: SchemaType.BOOLEAN, nullable: true },
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
  required: ["employee", "employer", "unpaidItems", "commission", "deductionDate"],
};
