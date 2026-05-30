/**
 * The extraction schema, expressed once and adapted for each provider:
 *  - `consumerServicesJsonSchema`  → Claude tool `input_schema` (JSON Schema)
 *  - `consumerServicesGeminiSchema` → Gemini `responseSchema`
 *
 * It mirrors `ConsumerServicesCase` plus an `evidence[]` array so the model cites
 * where each fact came from. The model's job is to REPORT what the documents say
 * — never to decide the legal outcome.
 */

import { SchemaType, type Schema } from "@google/generative-ai";

export const EXTRACTION_INSTRUCTIONS = `
You are a paralegal extracting facts from a UK consumer's documents about a paid
SERVICE that was not delivered as promised (e.g. a wedding photographer, venue or
supplier). Typical documents: a booking confirmation, an invoice with terms &
conditions, payment proofs (deposit, balance, pre-event), and screenshots of
unanswered messages, plus the consumer's own problem statement.

Rules:
- Report ONLY what the documents state. Do NOT decide the legal outcome.
- payment.totalPrice = the full contract price agreed (from the invoice/booking).
- payment.amountPaid = the SUM the consumer actually paid across all proofs
  (deposit + balance + any pre-event payments). Add them up.
- payment.depositPaidDate = the date the deposit was paid, in YYYY-MM-DD.
- service.bookingDate = when the contract/booking was made; service.serviceDate =
  the date the service was due to be performed (e.g. the wedding date). YYYY-MM-DD.
- delivery: "nothing_delivered" if the service was never performed / supplier
  vanished; "defective_or_late" if performed but poorly or late; "delivered_ok"
  if delivered acceptably; "unknown" if the documents do not say.
- supplierResponse: "unresponsive" if messages are ignored / no reply;
  "engaging" if the supplier is replying and discussing a fix; "refusing" if
  replying but refusing to put it right or refund; "unknown" otherwise.
- service.whatWasDelivered = a short plain-English note of what was and was not
  delivered.
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
export const consumerServicesJsonSchema = {
  type: "object",
  properties: {
    consumer: party(),
    supplier: party(),
    service: {
      type: "object",
      properties: {
        serviceType: { type: "string", description: "e.g. wedding photography" },
        bookingDate: { type: ["string", "null"], description: "YYYY-MM-DD or null" },
        serviceDate: {
          type: ["string", "null"],
          description: "YYYY-MM-DD the service was due to be performed, or null",
        },
        whatWasDelivered: { type: ["string", "null"] },
      },
      required: ["serviceType"],
    },
    payment: {
      type: "object",
      properties: {
        totalPrice: { type: "number", description: "Total contract price in GBP, e.g. 2400.00" },
        amountPaid: { type: "number", description: "Sum actually paid in GBP, e.g. 1800.00" },
        currency: { type: "string", enum: ["GBP"] },
        depositPaidDate: { type: ["string", "null"], description: "YYYY-MM-DD the deposit was paid" },
      },
      required: ["totalPrice", "amountPaid", "currency"],
    },
    delivery: {
      type: "string",
      enum: ["nothing_delivered", "defective_or_late", "delivered_ok", "unknown"],
    },
    supplierResponse: {
      type: "string",
      enum: ["unresponsive", "engaging", "refusing", "unknown"],
    },
    complaintDate: { type: ["string", "null"], description: "YYYY-MM-DD or null" },
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
  required: ["consumer", "supplier", "service", "payment", "delivery"],
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

export const consumerServicesGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    consumer: gParty,
    supplier: gParty,
    service: {
      type: SchemaType.OBJECT,
      properties: {
        serviceType: { type: SchemaType.STRING },
        bookingDate: { type: SchemaType.STRING, nullable: true },
        serviceDate: { type: SchemaType.STRING, nullable: true },
        whatWasDelivered: { type: SchemaType.STRING, nullable: true },
      },
      required: ["serviceType"],
    },
    payment: {
      type: SchemaType.OBJECT,
      properties: {
        totalPrice: { type: SchemaType.NUMBER },
        amountPaid: { type: SchemaType.NUMBER },
        currency: { type: SchemaType.STRING },
        depositPaidDate: { type: SchemaType.STRING, nullable: true },
      },
      required: ["totalPrice", "amountPaid", "currency"],
    },
    delivery: { type: SchemaType.STRING },
    supplierResponse: { type: SchemaType.STRING, nullable: true },
    complaintDate: { type: SchemaType.STRING, nullable: true },
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
  required: ["consumer", "supplier", "service", "payment", "delivery"],
};
