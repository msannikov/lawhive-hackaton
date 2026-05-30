/**
 * The extraction schema, expressed once and adapted for each provider:
 *  - `faultyGoodsJsonSchema`  → Claude tool `input_schema` (JSON Schema)
 *  - `faultyGoodsGeminiSchema` → Gemini `responseSchema`
 *
 * It mirrors `FaultyGoodsCase` plus an `evidence[]` array so the model cites
 * where each fact came from. The model's job is to REPORT what the documents
 * say — never to decide the legal outcome.
 */

import { SchemaType, type Schema } from "@google/generative-ai";

export const EXTRACTION_INSTRUCTIONS = `
You are a paralegal extracting facts from a UK consumer's faulty-goods documents
(here: a used car bought from a dealer — purchase invoice, V5C registration,
an independent mechanic's diagnostic report, and the dealer's text messages).

Rules:
- Report ONLY what the documents state. Do NOT decide the legal outcome.
- purchase.purchaseDate = the date the consumer took ownership / the goods were
  delivered (the invoice date), in YYYY-MM-DD. This starts the 30-day clock.
- purchase.amount = the price paid in GBP (e.g. 8495.00).
- goods.description = the item (for a vehicle: make, model, year); goods.identifier
  = the registration / VIN / serial; goods.mileageAtPurchase = the odometer
  reading at purchase if shown.
- fault.description = the problem reported; fault.diagnosticFinding = the
  independent mechanic's finding/diagnosis; fault.dateAppeared = when the fault
  was first noticed (YYYY-MM-DD), if stated.
- sellerType = "trader" if the seller is a business/dealer/garage (the invoice,
  VAT number, or trading name shows this); "private" only if clearly a private
  individual sale; otherwise "unknown".
- dealerResponse from the messages: "agrees_refund" | "offers_repair" |
  "repair_failed" (a repair was done but the fault persists) | "refuses" |
  "silent" | "unknown".
- repairAttempted = true only if the documents show the dealer already attempted
  a repair.
- Use null for anything not stated in the documents.
- For each important field, add an evidence entry citing the source document.
`.trim();

/** JSON Schema for Anthropic tool use (Claude). */
export const faultyGoodsJsonSchema = {
  type: "object",
  properties: {
    buyer: party(),
    seller: party(),
    sellerType: { type: "string", enum: ["trader", "private", "unknown"] },
    goods: {
      type: "object",
      properties: {
        description: { type: "string", description: "Item; for a vehicle: make, model, year" },
        identifier: { type: ["string", "null"], description: "Registration / VIN / serial" },
        mileageAtPurchase: { type: ["number", "null"], description: "Odometer reading at purchase" },
      },
      required: ["description"],
    },
    purchase: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Price paid in GBP, e.g. 8495.00" },
        currency: { type: "string", enum: ["GBP"] },
        purchaseDate: { type: "string", description: "YYYY-MM-DD ownership transferred / delivered" },
      },
      required: ["amount", "currency", "purchaseDate"],
    },
    fault: {
      type: "object",
      properties: {
        description: { type: "string", description: "The problem reported" },
        diagnosticFinding: { type: ["string", "null"], description: "Independent mechanic's finding" },
        dateAppeared: { type: ["string", "null"], description: "YYYY-MM-DD the fault first appeared" },
      },
      required: ["description"],
    },
    dealerResponse: {
      type: "string",
      enum: ["agrees_refund", "offers_repair", "repair_failed", "refuses", "silent", "unknown"],
    },
    repairAttempted: { type: ["boolean", "null"] },
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
  required: ["buyer", "seller", "goods", "purchase", "fault"],
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

export const faultyGoodsGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    buyer: gParty,
    seller: gParty,
    sellerType: { type: SchemaType.STRING, nullable: true },
    goods: {
      type: SchemaType.OBJECT,
      properties: {
        description: { type: SchemaType.STRING },
        identifier: { type: SchemaType.STRING, nullable: true },
        mileageAtPurchase: { type: SchemaType.NUMBER, nullable: true },
      },
      required: ["description"],
    },
    purchase: {
      type: SchemaType.OBJECT,
      properties: {
        amount: { type: SchemaType.NUMBER },
        currency: { type: SchemaType.STRING },
        purchaseDate: { type: SchemaType.STRING },
      },
      required: ["amount", "currency", "purchaseDate"],
    },
    fault: {
      type: SchemaType.OBJECT,
      properties: {
        description: { type: SchemaType.STRING },
        diagnosticFinding: { type: SchemaType.STRING, nullable: true },
        dateAppeared: { type: SchemaType.STRING, nullable: true },
      },
      required: ["description"],
    },
    dealerResponse: { type: SchemaType.STRING, nullable: true },
    repairAttempted: { type: SchemaType.BOOLEAN, nullable: true },
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
  required: ["buyer", "seller", "goods", "purchase", "fault"],
};
