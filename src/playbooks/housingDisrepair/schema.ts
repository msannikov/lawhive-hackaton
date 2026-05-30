/**
 * The extraction schema, expressed once and adapted for each provider:
 *  - `housingDisrepairJsonSchema`  → Claude tool `input_schema` (JSON Schema)
 *  - `housingDisrepairGeminiSchema` → Gemini `responseSchema`
 *
 * It mirrors `HousingDisrepairCase` plus an `evidence[]` array so the model cites
 * where each fact came from. The model's job is to REPORT what the documents
 * say — never to decide the legal outcome.
 */

import { SchemaType, type Schema } from "@google/generative-ai";

export const EXTRACTION_INSTRUCTIONS = `
You are a paralegal extracting facts from a UK social-housing tenant's
housing-disrepair documents (a tenancy agreement, a council / Environmental
Health inspection report, an email chain with the landlord, a GP letter, a
contractor's works form, a phone-call log and photos of damp / mould).

Rules:
- Report ONLY what the documents state. Do NOT decide the legal outcome.
- disrepair.firstReportedDate = the date the tenant FIRST notified the landlord
  of the damp / mould (the earliest report email or logged call), in YYYY-MM-DD.
- disrepair.roomsAffected = the list of rooms named as affected (e.g.
  "children's bedroom", "bathroom", "hallway").
- tenancy.landlordType = "council" if the landlord is a local authority,
  "housing_association" for a registered provider, otherwise "private".
- inspection.hhsrsCategory1 = true only if the report records a Category 1
  hazard under the HHSRS (Housing Health and Safety Rating System).
- landlordAction.worksCompleted = true if any remedial works were carried out;
  landlordAction.recurredAfterWorks = true if the documents say the damp / mould
  returned or worsened after those works.
- health.gpLetterProvided = true only if there is a GP / medical letter;
  health.vulnerableOccupant = true if a child, elderly or disabled person lives
  at the property.
- disrepair.ongoing = true unless the documents clearly state the defect is
  fully resolved.
- Use null for anything not stated in the documents.
- For each important field, add an evidence entry citing the source document.
`.trim();

/** JSON Schema for Anthropic tool use (Claude). */
export const housingDisrepairJsonSchema = {
  type: "object",
  properties: {
    tenant: party(),
    landlord: party(),
    property: {
      type: "object",
      properties: { address: { type: "string" }, postcode: { type: "string" } },
      required: ["address", "postcode"],
    },
    tenancy: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "YYYY-MM-DD the tenancy began" },
        landlordType: {
          type: "string",
          enum: ["council", "housing_association", "private", "unknown"],
        },
      },
      required: ["startDate"],
    },
    disrepair: {
      type: "object",
      properties: {
        description: { type: "string", description: "e.g. persistent black mould and damp" },
        roomsAffected: { type: "array", items: { type: "string" } },
        firstReportedDate: {
          type: "string",
          description: "YYYY-MM-DD the tenant first notified the landlord",
        },
        reportMethod: {
          type: "string",
          enum: ["phone", "email", "letter", "in_person", "portal", "unknown"],
        },
        ongoing: { type: "boolean" },
      },
      required: ["description", "firstReportedDate"],
    },
    landlordAction: {
      type: "object",
      properties: {
        acknowledged: { type: "boolean" },
        worksScheduled: { type: "boolean" },
        worksCompleted: { type: "boolean" },
        recurredAfterWorks: { type: "boolean" },
        lastActionDate: { type: ["string", "null"], description: "YYYY-MM-DD or null" },
      },
      required: ["acknowledged", "worksScheduled", "worksCompleted", "recurredAfterWorks"],
    },
    inspection: {
      type: "object",
      properties: {
        inspected: { type: "boolean" },
        inspectionDate: { type: ["string", "null"] },
        findingsSummary: { type: ["string", "null"] },
        hhsrsCategory1: { type: ["boolean", "null"] },
      },
      required: ["inspected"],
    },
    health: {
      type: "object",
      properties: {
        healthImpactReported: { type: "boolean" },
        gpLetterProvided: { type: "boolean" },
        vulnerableOccupant: { type: "boolean" },
        gpLetterDate: { type: ["string", "null"] },
        summary: { type: ["string", "null"] },
      },
      required: ["healthImpactReported", "gpLetterProvided", "vulnerableOccupant"],
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
  required: ["tenant", "landlord", "property", "tenancy", "disrepair", "landlordAction", "inspection", "health"],
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

export const housingDisrepairGeminiSchema: Schema = {
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
    tenancy: {
      type: SchemaType.OBJECT,
      properties: {
        startDate: { type: SchemaType.STRING },
        landlordType: { type: SchemaType.STRING, nullable: true },
      },
      required: ["startDate"],
    },
    disrepair: {
      type: SchemaType.OBJECT,
      properties: {
        description: { type: SchemaType.STRING },
        roomsAffected: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        firstReportedDate: { type: SchemaType.STRING },
        reportMethod: { type: SchemaType.STRING, nullable: true },
        ongoing: { type: SchemaType.BOOLEAN, nullable: true },
      },
      required: ["description", "firstReportedDate"],
    },
    landlordAction: {
      type: SchemaType.OBJECT,
      properties: {
        acknowledged: { type: SchemaType.BOOLEAN },
        worksScheduled: { type: SchemaType.BOOLEAN },
        worksCompleted: { type: SchemaType.BOOLEAN },
        recurredAfterWorks: { type: SchemaType.BOOLEAN },
        lastActionDate: { type: SchemaType.STRING, nullable: true },
      },
      required: ["acknowledged", "worksScheduled", "worksCompleted", "recurredAfterWorks"],
    },
    inspection: {
      type: SchemaType.OBJECT,
      properties: {
        inspected: { type: SchemaType.BOOLEAN },
        inspectionDate: { type: SchemaType.STRING, nullable: true },
        findingsSummary: { type: SchemaType.STRING, nullable: true },
        hhsrsCategory1: { type: SchemaType.BOOLEAN, nullable: true },
      },
      required: ["inspected"],
    },
    health: {
      type: SchemaType.OBJECT,
      properties: {
        healthImpactReported: { type: SchemaType.BOOLEAN },
        gpLetterProvided: { type: SchemaType.BOOLEAN },
        vulnerableOccupant: { type: SchemaType.BOOLEAN },
        gpLetterDate: { type: SchemaType.STRING, nullable: true },
        summary: { type: SchemaType.STRING, nullable: true },
      },
      required: ["healthImpactReported", "gpLetterProvided", "vulnerableOccupant"],
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
  required: ["tenant", "landlord", "property", "tenancy", "disrepair", "landlordAction", "inspection", "health"],
};
