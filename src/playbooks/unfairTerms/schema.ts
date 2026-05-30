/**
 * The extraction schema, expressed once and adapted for each provider:
 *  - `unfairTermsJsonSchema`  → Claude tool `input_schema` (JSON Schema)
 *  - `unfairTermsGeminiSchema` → Gemini `responseSchema`
 *
 * It mirrors `UnfairTermsCase` plus an `evidence[]` array so the model cites
 * where each fact came from. The model's job is to REPORT what the documents
 * say — never to decide whether a term is unfair.
 */

import { SchemaType, type Schema } from "@google/generative-ai";

export const EXTRACTION_INSTRUCTIONS = `
You are a paralegal extracting facts from a UK consumer's gym-membership dispute
documents (the membership agreement, a debt-collection letter, emails to/from
the gym, and bank statements).

Rules:
- Report ONLY what the documents state. Do NOT decide whether the term is unfair.
- membership.startDate in YYYY-MM-DD; membership.minimumTermMonths as a number
  (e.g. 12); membership.monthlyFee as a number; membership.autoRenews = true if
  the agreement says it renews automatically at the end of the minimum term.
- challengedTerm.type: minimum_term | auto_renewal | cancellation_charge | other
  — pick the clause the consumer is objecting to (long lock-in, hard-to-exit
  auto-renewal, or a disproportionate cancellation charge).
- challengedTerm.transparent = false if the clause is in dense small print, not
  in plain language, or buried; challengedTerm.prominent = false if it was not
  brought to the consumer's attention at sign-up.
- cancellationReason: job_loss | relocation | injury_or_illness |
  financial_hardship | other | unknown (why the consumer tried to cancel).
- gymResponse: refused | offered_reduction | agreed_to_waive | silent | unknown.
- debt.amount as a number; debt.collectorName = the collection agency's name;
  debt.aggressive = true if the letter uses threats, pressure, repeated contact
  or misleading statements about the consumer's legal position.
- Use null for anything not stated in the documents.
- For each important field, add an evidence entry citing the source document.
`.trim();

/** JSON Schema for Anthropic tool use (Claude). */
export const unfairTermsJsonSchema = {
  type: "object",
  properties: {
    consumer: party(),
    business: party(),
    membership: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "YYYY-MM-DD the membership started" },
        minimumTermMonths: { type: "number", description: "Minimum / lock-in term in months, e.g. 12" },
        monthlyFee: { type: "number", description: "Monthly fee in GBP, e.g. 44.99" },
        currency: { type: "string", enum: ["GBP"] },
        autoRenews: { type: "boolean" },
      },
      required: ["startDate", "minimumTermMonths", "monthlyFee", "currency", "autoRenews"],
    },
    challengedTerm: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["minimum_term", "auto_renewal", "cancellation_charge", "other"],
        },
        description: { type: "string", description: "Verbatim or paraphrased text of the term" },
        transparent: { type: "boolean", description: "Plain language and not buried?" },
        prominent: { type: "boolean", description: "Brought to the consumer's attention at sign-up?" },
      },
      required: ["type", "description", "transparent", "prominent"],
    },
    cancellationReason: {
      type: "string",
      enum: ["job_loss", "relocation", "injury_or_illness", "financial_hardship", "other", "unknown"],
    },
    cancellationAttemptDate: { type: ["string", "null"], description: "YYYY-MM-DD or null" },
    gymResponse: {
      type: "string",
      enum: ["refused", "offered_reduction", "agreed_to_waive", "silent", "unknown"],
    },
    debt: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Amount claimed in GBP" },
        currency: { type: "string", enum: ["GBP"] },
        collectorName: { type: "string", description: "Name of the debt-collection agency" },
        letterDate: { type: ["string", "null"], description: "YYYY-MM-DD of the collection letter or null" },
        disputed: { type: ["boolean", "null"] },
        aggressive: { type: ["boolean", "null"], description: "Threats / pressure / misleading statements?" },
      },
      required: ["amount", "currency", "collectorName"],
    },
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
  required: ["consumer", "business", "membership", "challengedTerm", "debt"],
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

export const unfairTermsGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    consumer: gParty,
    business: gParty,
    membership: {
      type: SchemaType.OBJECT,
      properties: {
        startDate: { type: SchemaType.STRING },
        minimumTermMonths: { type: SchemaType.NUMBER },
        monthlyFee: { type: SchemaType.NUMBER },
        currency: { type: SchemaType.STRING },
        autoRenews: { type: SchemaType.BOOLEAN },
      },
      required: ["startDate", "minimumTermMonths", "monthlyFee", "currency", "autoRenews"],
    },
    challengedTerm: {
      type: SchemaType.OBJECT,
      properties: {
        type: { type: SchemaType.STRING },
        description: { type: SchemaType.STRING },
        transparent: { type: SchemaType.BOOLEAN },
        prominent: { type: SchemaType.BOOLEAN },
      },
      required: ["type", "description", "transparent", "prominent"],
    },
    cancellationReason: { type: SchemaType.STRING },
    cancellationAttemptDate: { type: SchemaType.STRING, nullable: true },
    gymResponse: { type: SchemaType.STRING },
    debt: {
      type: SchemaType.OBJECT,
      properties: {
        amount: { type: SchemaType.NUMBER },
        currency: { type: SchemaType.STRING },
        collectorName: { type: SchemaType.STRING },
        letterDate: { type: SchemaType.STRING, nullable: true },
        disputed: { type: SchemaType.BOOLEAN, nullable: true },
        aggressive: { type: SchemaType.BOOLEAN, nullable: true },
      },
      required: ["amount", "currency", "collectorName"],
    },
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
  required: ["consumer", "business", "membership", "challengedTerm", "debt"],
};
