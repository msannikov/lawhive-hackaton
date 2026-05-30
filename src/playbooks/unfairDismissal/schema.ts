/**
 * The extraction schema, expressed once and adapted for each provider:
 *  - `unfairDismissalJsonSchema`   → Claude tool `input_schema` (JSON Schema)
 *  - `unfairDismissalGeminiSchema` → Gemini `responseSchema`
 *
 * It mirrors `UnfairDismissalCase` plus an `evidence[]` array so the model cites
 * where each fact came from. The model's job is to REPORT what the documents
 * say — never to decide the legal outcome (genuine redundancy vs sham, whether
 * the dismissal was discriminatory, or whether the settlement offer is fair).
 */

import { SchemaType, type Schema } from "@google/generative-ai";

export const EXTRACTION_INSTRUCTIONS = `
You are a paralegal extracting facts from a UK employee's unfair-dismissal /
discrimination documents (employment contract, redundancy/dismissal notice,
grievance letter + outcome, redundancy appeal + outcome, ACAS Early Conciliation
certificate, employer settlement offer, payslips, correspondence).

Rules:
- Report ONLY what the documents state. Do NOT decide the legal outcome (do not
  decide whether the redundancy was genuine or a sham, whether there was
  discrimination, or whether the settlement offer is fair).
- employment.startDate = the start of continuous service (the contract's
  "continuous service begins" / payslip "start date"), in YYYY-MM-DD.
- employment.endDate = the EFFECTIVE DATE OF TERMINATION (EDT): the last day of
  employment (e.g. the "last day of employment" in the redundancy letter), NOT
  the date the letter was written. Use YYYY-MM-DD.
- dismissal.reason: redundancy | conduct | capability |
  some_other_substantial_reason | other (use the reason the EMPLOYER gives).
- dismissal.noticeDate = the date of the dismissal/redundancy letter.
- discrimination.alleged = true if any document alleges discrimination or an
  Equality Act 2010 claim (e.g. the grievance or appeal alleges sex
  discrimination, or the redundancy is said to be a pretext/victimisation).
- discrimination.ground = the protected characteristic relied on (here usually
  "sex").
- discrimination.protectedActDone = true if the employee did a "protected act"
  (e.g. a grievance expressly alleging discrimination) and the dismissal is said
  to be a detriment connected to it (victimisation).
- grievance / appeal: set raised=true only if the document shows it happened;
  outcome = upheld | not_upheld | pending | unknown.
- acas: notificationDate = "Date Acas received Early Conciliation notification"
  (Day A); certificateDate = "Date Acas issued this certificate" (Day B);
  completed=true if an EC certificate is present.
- settlement: amount = the gross settlement sum offered; vehicle = "cot3" if the
  offer is made/recorded through ACAS as a COT3, "settlement_agreement" if it is
  a s203 ERA 1996 settlement agreement, else "unknown"; acceptByDate = any stated
  acceptance deadline.
- pay: annualGross / monthlyGross / monthlyNet from the contract or payslips.
- Use null for anything not stated in the documents.
- For each important field, add an evidence entry citing the source document.
`.trim();

/** JSON Schema for Anthropic tool use (Claude). */
export const unfairDismissalJsonSchema = {
  type: "object",
  properties: {
    employee: party(),
    employer: party(),
    employment: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "YYYY-MM-DD start of continuous service" },
        endDate: {
          type: ["string", "null"],
          description: "YYYY-MM-DD effective date of termination (last day of employment), or null",
        },
        jobTitle: { type: ["string", "null"] },
      },
      required: ["startDate"],
    },
    dismissal: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          enum: ["redundancy", "conduct", "capability", "some_other_substantial_reason", "other"],
        },
        reasonGiven: { type: ["string", "null"], description: "Reason text from the dismissal letter" },
        noticeDate: { type: ["string", "null"], description: "YYYY-MM-DD date of the dismissal/redundancy letter" },
      },
      required: ["reason"],
    },
    discrimination: {
      type: "object",
      properties: {
        alleged: { type: "boolean" },
        ground: {
          type: ["string", "null"],
          enum: [
            "sex", "pregnancy_maternity", "race", "disability", "age",
            "religion_belief", "sexual_orientation", "gender_reassignment",
            "marriage_civil_partnership", "other", null,
          ],
        },
        facts: { type: ["string", "null"], description: "Short summary of the alleged discrimination facts" },
        protectedActDone: { type: ["boolean", "null"] },
      },
      required: ["alleged"],
    },
    grievance: internalProcess(),
    appeal: internalProcess(),
    acas: {
      type: "object",
      properties: {
        completed: { type: "boolean" },
        notificationDate: { type: ["string", "null"], description: "YYYY-MM-DD Day A (ACAS received EC notification)" },
        certificateDate: { type: ["string", "null"], description: "YYYY-MM-DD Day B (EC certificate issued)" },
        certificateNumber: { type: ["string", "null"] },
      },
      required: ["completed"],
    },
    settlement: {
      type: "object",
      properties: {
        offered: { type: "boolean" },
        amount: { type: ["number", "null"], description: "Gross settlement sum offered, e.g. 4450" },
        currency: { type: ["string", "null"], enum: ["GBP", null] },
        offerDate: { type: ["string", "null"], description: "YYYY-MM-DD" },
        acceptByDate: { type: ["string", "null"], description: "YYYY-MM-DD acceptance deadline if stated" },
        vehicle: { type: ["string", "null"], enum: ["cot3", "settlement_agreement", "unknown", null] },
      },
      required: ["offered"],
    },
    pay: {
      type: "object",
      properties: {
        annualGross: { type: ["number", "null"], description: "Gross basic salary per annum" },
        monthlyGross: { type: ["number", "null"], description: "Gross basic pay per month" },
        monthlyNet: { type: ["number", "null"], description: "Net pay per month" },
        currency: { type: ["string", "null"], enum: ["GBP", null] },
      },
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
  required: ["employee", "employer", "employment", "dismissal", "discrimination", "acas"],
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

function internalProcess() {
  return {
    type: "object",
    properties: {
      raised: { type: "boolean" },
      raisedDate: { type: ["string", "null"], description: "YYYY-MM-DD" },
      outcomeDate: { type: ["string", "null"], description: "YYYY-MM-DD" },
      outcome: { type: ["string", "null"], enum: ["upheld", "not_upheld", "pending", "unknown", null] },
    },
    required: ["raised"],
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

const gInternalProcess: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    raised: { type: SchemaType.BOOLEAN },
    raisedDate: { type: SchemaType.STRING, nullable: true },
    outcomeDate: { type: SchemaType.STRING, nullable: true },
    outcome: { type: SchemaType.STRING, nullable: true },
  },
  required: ["raised"],
};

export const unfairDismissalGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    employee: gParty,
    employer: gParty,
    employment: {
      type: SchemaType.OBJECT,
      properties: {
        startDate: { type: SchemaType.STRING },
        endDate: { type: SchemaType.STRING, nullable: true },
        jobTitle: { type: SchemaType.STRING, nullable: true },
      },
      required: ["startDate"],
    },
    dismissal: {
      type: SchemaType.OBJECT,
      properties: {
        reason: { type: SchemaType.STRING },
        reasonGiven: { type: SchemaType.STRING, nullable: true },
        noticeDate: { type: SchemaType.STRING, nullable: true },
      },
      required: ["reason"],
    },
    discrimination: {
      type: SchemaType.OBJECT,
      properties: {
        alleged: { type: SchemaType.BOOLEAN },
        ground: { type: SchemaType.STRING, nullable: true },
        facts: { type: SchemaType.STRING, nullable: true },
        protectedActDone: { type: SchemaType.BOOLEAN, nullable: true },
      },
      required: ["alleged"],
    },
    grievance: gInternalProcess,
    appeal: gInternalProcess,
    acas: {
      type: SchemaType.OBJECT,
      properties: {
        completed: { type: SchemaType.BOOLEAN },
        notificationDate: { type: SchemaType.STRING, nullable: true },
        certificateDate: { type: SchemaType.STRING, nullable: true },
        certificateNumber: { type: SchemaType.STRING, nullable: true },
      },
      required: ["completed"],
    },
    settlement: {
      type: SchemaType.OBJECT,
      properties: {
        offered: { type: SchemaType.BOOLEAN },
        amount: { type: SchemaType.NUMBER, nullable: true },
        currency: { type: SchemaType.STRING, nullable: true },
        offerDate: { type: SchemaType.STRING, nullable: true },
        acceptByDate: { type: SchemaType.STRING, nullable: true },
        vehicle: { type: SchemaType.STRING, nullable: true },
      },
      required: ["offered"],
    },
    pay: {
      type: SchemaType.OBJECT,
      properties: {
        annualGross: { type: SchemaType.NUMBER, nullable: true },
        monthlyGross: { type: SchemaType.NUMBER, nullable: true },
        monthlyNet: { type: SchemaType.NUMBER, nullable: true },
        currency: { type: SchemaType.STRING, nullable: true },
      },
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
  required: ["employee", "employer", "employment", "dismissal", "discrimination", "acas"],
};
