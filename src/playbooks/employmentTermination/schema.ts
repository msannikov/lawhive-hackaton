/**
 * Extraction schema for the employment-termination stub. Same dual-format
 * pattern as the deposit playbook (Claude JSON Schema + Gemini responseSchema).
 */

import { SchemaType, type Schema } from "@google/generative-ai";

export const EXTRACTION_INSTRUCTIONS = `
You are a paralegal extracting facts from a UK employee's documents (employment
contract, dismissal/redundancy letter, payslips). Report ONLY what the documents
state; do NOT decide the legal outcome.
- employment.startDate / employment.endDate in YYYY-MM-DD (endDate = effective
  date of termination).
- termination.type: dismissal | redundancy | resignation | other.
- Use null for anything not stated. Add an evidence entry citing the source doc.
`.trim();

export const employmentJsonSchema = {
  type: "object",
  properties: {
    employee: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
    employer: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
    employment: {
      type: "object",
      properties: {
        startDate: { type: ["string", "null"] },
        endDate: { type: ["string", "null"] },
        jobTitle: { type: ["string", "null"] },
      },
    },
    termination: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["dismissal", "redundancy", "resignation", "other"] },
        reasonGiven: { type: ["string", "null"] },
        noticeGiven: { type: ["boolean", "null"] },
      },
      required: ["type"],
    },
    evidence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: { type: "string" },
          value: {},
          source: { type: "string" },
        },
        required: ["field", "source"],
      },
    },
  },
  required: ["employee", "employer", "employment", "termination"],
} as const;

export const employmentGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    employee: {
      type: SchemaType.OBJECT,
      properties: { name: { type: SchemaType.STRING } },
      required: ["name"],
    },
    employer: {
      type: SchemaType.OBJECT,
      properties: { name: { type: SchemaType.STRING } },
      required: ["name"],
    },
    employment: {
      type: SchemaType.OBJECT,
      properties: {
        startDate: { type: SchemaType.STRING, nullable: true },
        endDate: { type: SchemaType.STRING, nullable: true },
        jobTitle: { type: SchemaType.STRING, nullable: true },
      },
    },
    termination: {
      type: SchemaType.OBJECT,
      properties: {
        type: { type: SchemaType.STRING },
        reasonGiven: { type: SchemaType.STRING, nullable: true },
        noticeGiven: { type: SchemaType.BOOLEAN, nullable: true },
      },
      required: ["type"],
    },
    evidence: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          field: { type: SchemaType.STRING },
          value: { type: SchemaType.STRING, nullable: true },
          source: { type: SchemaType.STRING },
        },
        required: ["field", "source"],
      },
    },
  },
  required: ["employee", "employer", "employment", "termination"],
};
