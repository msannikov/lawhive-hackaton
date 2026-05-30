/**
 * The extraction schema, expressed once and adapted for each provider:
 *  - `buildingDisputeJsonSchema`   → Claude tool `input_schema` (JSON Schema)
 *  - `buildingDisputeGeminiSchema` → Gemini `responseSchema`
 *
 * It mirrors `BuildingDisputeCase` plus an `evidence[]` array so the model cites
 * where each fact came from. The model's job is to REPORT what the documents say
 * — never to decide the legal outcome.
 */

import { SchemaType, type Schema } from "@google/generative-ai";

export const EXTRACTION_INSTRUCTIONS = `
You are a paralegal extracting facts from a UK customer's building-dispute
documents about home-improvement work (e.g. a kitchen renovation) that was
abandoned, left incomplete or done defectively. Typical documents: the
contractor's quote/contract, bank-transfer confirmations of payments to the
contractor, text messages with the contractor (including any threatening
message), a remedial/completion quote from a new contractor, an invoice for
urgent remedial works, and photos of the incomplete or defective work.

Rules:
- Report ONLY what the documents state. Do NOT decide the legal outcome.
- contract.scopeOfWorks = a short description of what the original contractor
  agreed to do (e.g. "full kitchen renovation").
- contract.agreedPrice = the agreed contract price in GBP if one is stated.
- payments[] = every transfer the customer made TO the contractor. For each, set
  amount (GBP), date (YYYY-MM-DD the transfer was sent) and reference if shown.
  Match the recipient to the contractor (allowing for initials, e.g. "S Caldwell"
  for "Steve Caldwell").
- defects = a concise description of what is incomplete or defective, drawn from
  the photos, the remedial quote/invoice and the messages.
- remedialCosts[] = the remedial/completion quote(s) and invoice(s) from OTHER
  contractors that evidence the cost of finishing or putting right the work. For
  each, set source (the firm), amount (GBP total, inc VAT where shown), kind
  ("quote" for a priced estimate, "invoice" for work already done), and date.
  Do NOT put the original contractor's own demands here.
- contractorResponse: abandoned | disputes_liability | threatening | negotiating
  | silent | unknown. Use "threatening" if any message from the contractor is
  abusive or intimidating.
- threateningConduct = true if any message from the contractor is abusive,
  intimidating or harassing.
- breachDate = YYYY-MM-DD the contractor abandoned the works or the works clearly
  went wrong, if it can be identified.
- customerType = "consumer" unless the documents show the customer engaged the
  contractor in the course of a business.
- Use null for anything not stated in the documents.
- For each important field, add an evidence entry citing the source document.
`.trim();

/** JSON Schema for Anthropic tool use (Claude). */
export const buildingDisputeJsonSchema = {
  type: "object",
  properties: {
    customer: party(),
    contractor: party(),
    property: {
      type: "object",
      properties: { address: { type: "string" }, postcode: { type: "string" } },
      required: ["address", "postcode"],
    },
    customerType: { type: "string", enum: ["consumer", "business"] },
    contract: {
      type: "object",
      properties: {
        scopeOfWorks: { type: "string", description: "What the contractor agreed to do" },
        agreedPrice: { type: ["number", "null"], description: "Agreed price in GBP, e.g. 8000" },
        currency: { type: "string", enum: ["GBP"] },
        agreedDate: { type: ["string", "null"], description: "YYYY-MM-DD or null" },
      },
      required: ["scopeOfWorks", "currency"],
    },
    payments: {
      type: "array",
      description: "Every transfer the customer made to the contractor.",
      items: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Amount in GBP, e.g. 4000" },
          date: { type: "string", description: "YYYY-MM-DD the transfer was sent" },
          reference: { type: ["string", "null"] },
        },
        required: ["amount", "date"],
      },
    },
    defects: {
      type: "string",
      description: "What is incomplete or defective, from photos/quotes/messages.",
    },
    remedialCosts: {
      type: "array",
      description: "Completion/remedial quotes and invoices from other contractors (the loss).",
      items: {
        type: "object",
        properties: {
          source: { type: "string", description: "The remedial contractor / firm" },
          amount: { type: "number", description: "Total in GBP, inc VAT where shown" },
          kind: { type: "string", enum: ["quote", "invoice"] },
          date: { type: ["string", "null"] },
          reference: { type: ["string", "null"] },
        },
        required: ["source", "amount", "kind"],
      },
    },
    contractorResponse: {
      type: "string",
      enum: [
        "abandoned",
        "disputes_liability",
        "threatening",
        "negotiating",
        "silent",
        "unknown",
      ],
    },
    threateningConduct: { type: ["boolean", "null"] },
    breachDate: { type: ["string", "null"], description: "YYYY-MM-DD or null" },
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
  required: ["customer", "contractor", "property", "contract", "payments", "remedialCosts"],
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

export const buildingDisputeGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    customer: gParty,
    contractor: gParty,
    property: {
      type: SchemaType.OBJECT,
      properties: {
        address: { type: SchemaType.STRING },
        postcode: { type: SchemaType.STRING },
      },
      required: ["address", "postcode"],
    },
    customerType: { type: SchemaType.STRING, nullable: true },
    contract: {
      type: SchemaType.OBJECT,
      properties: {
        scopeOfWorks: { type: SchemaType.STRING },
        agreedPrice: { type: SchemaType.NUMBER, nullable: true },
        currency: { type: SchemaType.STRING },
        agreedDate: { type: SchemaType.STRING, nullable: true },
      },
      required: ["scopeOfWorks", "currency"],
    },
    payments: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          amount: { type: SchemaType.NUMBER },
          date: { type: SchemaType.STRING },
          reference: { type: SchemaType.STRING, nullable: true },
        },
        required: ["amount", "date"],
      },
    },
    defects: { type: SchemaType.STRING, nullable: true },
    remedialCosts: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          source: { type: SchemaType.STRING },
          amount: { type: SchemaType.NUMBER },
          kind: { type: SchemaType.STRING },
          date: { type: SchemaType.STRING, nullable: true },
          reference: { type: SchemaType.STRING, nullable: true },
        },
        required: ["source", "amount", "kind"],
      },
    },
    contractorResponse: { type: SchemaType.STRING, nullable: true },
    threateningConduct: { type: SchemaType.BOOLEAN, nullable: true },
    breachDate: { type: SchemaType.STRING, nullable: true },
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
  required: ["customer", "contractor", "property", "contract", "payments", "remedialCosts"],
};
