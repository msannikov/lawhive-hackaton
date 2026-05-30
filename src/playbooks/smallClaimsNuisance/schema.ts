/**
 * The extraction schema, expressed once and adapted for each provider:
 *  - `nuisanceCaseJsonSchema`   → Claude tool `input_schema` (JSON Schema)
 *  - `nuisanceCaseGeminiSchema` → Gemini `responseSchema`
 *
 * It mirrors `SmallClaimsNuisanceCase` plus an `evidence[]` array so the model
 * cites where each fact came from. The model's job is to REPORT what the
 * documents say (claim form, directions order, court correspondence, judgment,
 * SJE letter, builder's quote) — never to decide the legal outcome.
 */

import { SchemaType, type Schema } from "@google/generative-ai";

export const EXTRACTION_INSTRUCTIONS = `
You are a paralegal extracting facts from the file of a UK small-claims private
NUISANCE case that is ALREADY IN PROCEEDINGS (tree-root encroachment causing
property damage). Documents may include: an N1 claim form + particulars, an N9B
defence, a court directions order, court correspondence about a MISSED deadline,
a late witness statement, a single-joint-expert (SJE) letter, a judgment/order,
and a builder's quotation.

Rules:
- Report ONLY what the documents state. Do NOT decide the legal outcome.
- caseNumber = the claim/case number (e.g. "K7QZ4318"); court = the issuing court.
- nuisance.remedialCost = the reasonable remedial cost claimed, in GBP (the
  builder's quote total), as a number.
- directions.deadlines[] = each dated step in the directions order, with step
  (e.g. "witness statements", "disclosure", "schedule of loss") and date YYYY-MM-DD.
- missedDeadline = the directions step the court correspondence says was NOT met,
  with its dueDate (YYYY-MM-DD). Set documentFiled=true only if the documents show
  the outstanding document has since been filed/served.
- judgment = any order/judgment MADE in the case: date (YYYY-MM-DD) and basis
  ("default" if entered in default, "non_attendance" if a party failed to attend,
  "on_merits" if decided after a hearing, else "unknown"). Set
  permissionToAppealRefused=true if the order records that permission to appeal
  was refused.
- sje = position on the single joint expert: "proposed" if one was invited/offered,
  "agreed", "obtained" if a report exists, "declined" if none was agreed/obtained,
  else "unknown".
- All dates in YYYY-MM-DD. Use null for anything not stated in the documents.
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
      representative: { type: ["string", "null"], description: "Solicitors on the record, if any" },
    },
    required: ["name"],
  };
}

/** JSON Schema for Anthropic tool use (Claude). */
export const nuisanceCaseJsonSchema = {
  type: "object",
  properties: {
    claimant: party(),
    defendant: party(),
    court: { type: "string", description: "e.g. County Court at Sheffield" },
    caseNumber: { type: "string", description: "Claim/case number, e.g. K7QZ4318" },
    nuisance: {
      type: "object",
      properties: {
        description: { type: "string", description: "The encroachment + damage" },
        remedialCost: { type: "number", description: "Remedial cost claimed in GBP, e.g. 4200" },
        currency: { type: "string", enum: ["GBP"] },
        remedialCostSource: { type: ["string", "null"], description: "e.g. builder's quote reference" },
      },
      required: ["description", "remedialCost", "currency"],
    },
    directions: {
      type: "object",
      properties: {
        orderDate: { type: ["string", "null"], description: "YYYY-MM-DD the order was made" },
        deadlines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              step: { type: "string", description: "e.g. witness statements, disclosure" },
              date: { type: "string", description: "YYYY-MM-DD" },
            },
            required: ["step", "date"],
          },
        },
        finalHearingDate: { type: ["string", "null"], description: "YYYY-MM-DD" },
      },
      required: ["deadlines"],
    },
    missedDeadline: {
      type: ["object", "null"],
      properties: {
        step: { type: "string", description: "e.g. witness statement" },
        dueDate: { type: "string", description: "YYYY-MM-DD the step was due and missed" },
        documentFiled: { type: ["boolean", "null"] },
      },
      required: ["step", "dueDate"],
    },
    judgment: {
      type: ["object", "null"],
      properties: {
        date: { type: "string", description: "YYYY-MM-DD the judgment/order was made" },
        basis: { type: "string", enum: ["default", "non_attendance", "on_merits", "unknown"] },
        outcome: { type: ["string", "null"], description: "e.g. claim dismissed" },
        permissionToAppealRefused: { type: ["boolean", "null"] },
      },
      required: ["date", "basis"],
    },
    sje: {
      type: "string",
      enum: ["proposed", "agreed", "obtained", "declined", "not_applicable", "unknown"],
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
  required: ["claimant", "defendant", "court", "caseNumber", "nuisance", "directions"],
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
    representative: { type: SchemaType.STRING, nullable: true },
  },
  required: ["name"],
};

export const nuisanceCaseGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    claimant: gParty,
    defendant: gParty,
    court: { type: SchemaType.STRING },
    caseNumber: { type: SchemaType.STRING },
    nuisance: {
      type: SchemaType.OBJECT,
      properties: {
        description: { type: SchemaType.STRING },
        remedialCost: { type: SchemaType.NUMBER },
        currency: { type: SchemaType.STRING },
        remedialCostSource: { type: SchemaType.STRING, nullable: true },
      },
      required: ["description", "remedialCost", "currency"],
    },
    directions: {
      type: SchemaType.OBJECT,
      properties: {
        orderDate: { type: SchemaType.STRING, nullable: true },
        deadlines: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              step: { type: SchemaType.STRING },
              date: { type: SchemaType.STRING },
            },
            required: ["step", "date"],
          },
        },
        finalHearingDate: { type: SchemaType.STRING, nullable: true },
      },
      required: ["deadlines"],
    },
    missedDeadline: {
      type: SchemaType.OBJECT,
      nullable: true,
      properties: {
        step: { type: SchemaType.STRING },
        dueDate: { type: SchemaType.STRING },
        documentFiled: { type: SchemaType.BOOLEAN, nullable: true },
      },
      required: ["step", "dueDate"],
    },
    judgment: {
      type: SchemaType.OBJECT,
      nullable: true,
      properties: {
        date: { type: SchemaType.STRING },
        basis: { type: SchemaType.STRING },
        outcome: { type: SchemaType.STRING, nullable: true },
        permissionToAppealRefused: { type: SchemaType.BOOLEAN, nullable: true },
      },
      required: ["date", "basis"],
    },
    sje: { type: SchemaType.STRING },
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
  required: ["claimant", "defendant", "court", "caseNumber", "nuisance", "directions"],
};
