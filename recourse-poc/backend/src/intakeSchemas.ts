/**
 * Per-domain intake question lists for the guided (no-VLM) path.
 *
 * Each field's `name` is a DOTTED PATH into the raw facts object the playbook's
 * `normalize` consumes (e.g. "deposit.amount" → raw.deposit.amount). The frontend
 * collects answers keyed by these names and expands them into the nested shape
 * before POSTing to /api/assess, so the facts validate through the SAME
 * normaliser the document/VLM path uses.
 *
 * Boolean questions are typed "boolean" (not a yes/no select) on purpose: the
 * normaliser does `!!raw.protection.protectedInScheme`, and the string "no" is
 * truthy — so a select would silently flip a "No" into protected. A real boolean
 * avoids that trap.
 */

import { getPlaybook, PLAYBOOKS } from "../../../src/playbooks/registry.ts";

export type IntakeFieldType =
  | "text"
  | "number"
  | "money"
  | "date"
  | "boolean"
  | "select"
  | "textarea";

export interface IntakeFieldOption {
  value: string;
  label: string;
}

export interface IntakeField {
  /** Dotted path into the facts object, e.g. "deposit.amount". */
  name: string;
  label: string;
  type: IntakeFieldType;
  required?: boolean;
  help?: string;
  group?: string;
  placeholder?: string;
  options?: IntakeFieldOption[];
}

export interface IntakeSchema {
  domain: string;
  title: string;
  intro?: string;
  fields: IntakeField[];
}

const DEPOSIT_RETURN_INTAKE: IntakeSchema = {
  domain: "deposit_return",
  title: "Your tenancy deposit",
  intro:
    "A few questions so we can work out your options and the exact dates that matter. " +
    "You can edit anything that was filled in for you.",
  fields: [
    // The deposit
    {
      name: "deposit.amount",
      label: "How much was the deposit?",
      type: "money",
      required: true,
      group: "The deposit",
      placeholder: "980.00",
    },
    {
      name: "deposit.paidDate",
      label: "When did the landlord receive it?",
      type: "date",
      required: true,
      group: "The deposit",
      help: "This starts the 30-day protection clock.",
    },
    // The tenancy
    {
      name: "tenancy.startDate",
      label: "When did the tenancy start?",
      type: "date",
      required: true,
      group: "The tenancy",
    },
    {
      name: "tenancy.ended",
      label: "Has the tenancy ended?",
      type: "boolean",
      group: "The tenancy",
    },
    {
      name: "tenancy.endDate",
      label: "If it has ended, when?",
      type: "date",
      group: "The tenancy",
      help: "Leave blank if the tenancy is ongoing.",
    },
    // Protection
    {
      name: "protection.protectedInScheme",
      label: "Is your deposit protected in a government scheme (DPS, mydeposits or TDS)?",
      type: "boolean",
      group: "Deposit protection",
      help: "If you've checked all three and found no record, answer No.",
    },
    {
      name: "protection.prescribedInformationGiven",
      label: "Did the landlord give you the scheme's “prescribed information”?",
      type: "boolean",
      group: "Deposit protection",
      help: "A formal set of details about where the deposit is protected and how to get it back.",
    },
    // The landlord
    {
      name: "landlordResponse",
      label: "How is the landlord responding?",
      type: "select",
      group: "The landlord",
      options: [
        { value: "unknown", label: "I haven't asked yet / I'm not sure" },
        { value: "agrees_in_full", label: "They've agreed to return it in full" },
        { value: "disputes_deductions", label: "They want to keep some or all of it" },
        { value: "silent", label: "They're not responding" },
      ],
    },
    {
      name: "landlord.name",
      label: "Landlord or agent name",
      type: "text",
      required: true,
      group: "The landlord",
    },
    {
      name: "landlord.address",
      label: "Landlord or agent address",
      type: "text",
      group: "The landlord",
    },
    {
      name: "landlord.email",
      label: "Landlord or agent email",
      type: "text",
      group: "The landlord",
    },
    // You + the property
    {
      name: "tenant.name",
      label: "Your name",
      type: "text",
      required: true,
      group: "Your details",
    },
    {
      name: "tenant.address",
      label: "Your current address",
      type: "text",
      group: "Your details",
    },
    {
      name: "property.address",
      label: "The rented property address",
      type: "text",
      required: true,
      group: "Your details",
    },
    {
      name: "property.postcode",
      label: "Property postcode",
      type: "text",
      group: "Your details",
      help: "Used when you search the deposit schemes.",
    },
  ],
};

// Hand-authored schemas take precedence; every other registered playbook gets a
// schema DERIVED from its extraction jsonSchema (see below).
export const INTAKE_SCHEMAS: Record<string, IntakeSchema> = {
  deposit_return: DEPOSIT_RETURN_INTAKE,
};

// ── Generic intake schema derived from a playbook's extraction jsonSchema ─────
// The VLM extraction schema already describes every fact + which are required,
// so we flatten it (nested objects → dotted field names, arrays + `evidence`
// skipped) into the funnel's IntakeField shape. One converter serves all domains.

function humanize(seg: string): string {
  const words = seg.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function fieldType(name: string, prop: any): IntakeFieldType {
  const types: string[] = Array.isArray(prop?.type) ? prop.type : prop?.type ? [prop.type] : [];
  const desc: string = typeof prop?.description === "string" ? prop.description : "";
  if (Array.isArray(prop?.enum)) return "select";
  if (types.includes("boolean")) return "boolean";
  if (types.includes("number") || types.includes("integer")) {
    return /amount|price|fee|total|cost|sum|paid|deposit|salary|wage|pay|compensation|quote|balance|owed/i.test(name) ||
      /£|gbp/i.test(desc)
      ? "money"
      : "number";
  }
  if (/YYYY-MM-DD/.test(desc) || /date$/i.test(name)) return "date";
  if (/details|description|reason|notes|summary|message|narrative/i.test(name)) return "textarea";
  return "text";
}

function collectFields(schema: any, prefix: string, parentRequired: boolean, group: string, out: IntakeField[]): void {
  const props = (schema && schema.properties) || {};
  const required: string[] = Array.isArray(schema?.required) ? schema.required : [];
  for (const [name, raw] of Object.entries<any>(props)) {
    if (name === "evidence") continue;
    const path = prefix ? `${prefix}.${name}` : name;
    const isReq = parentRequired && required.includes(name);
    const types: string[] = Array.isArray(raw?.type) ? raw.type : raw?.type ? [raw.type] : [];
    if (types.includes("array")) {
      // A REQUIRED array of objects (e.g. line items) → collect one representative
      // entry at index 0 so the form satisfies "at least one". Optional/scalar arrays skipped.
      const items: any = raw.items;
      const itemTypes: string[] = Array.isArray(items?.type) ? items.type : items?.type ? [items.type] : [];
      if (isReq && itemTypes.includes("object") && items?.properties) {
        collectFields(items, `${path}.0`, true, humanize(name), out);
      }
      continue;
    }
    if (types.includes("object") && raw.properties) {
      collectFields(raw, path, isReq, humanize(name), out);
      continue;
    }
    const type = fieldType(name, raw);
    const field: IntakeField = { name: path, label: humanize(name), type, group: group || "Details" };
    if (isReq) field.required = true;
    if (typeof raw?.description === "string" && raw.description.length <= 90 && !/YYYY-MM-DD/.test(raw.description)) {
      field.help = raw.description;
    }
    if (type === "select" && Array.isArray(raw.enum)) {
      field.options = raw.enum.filter((v: unknown) => typeof v === "string").map((v: string) => ({ value: v, label: humanize(v) }));
    }
    out.push(field);
  }
}

function deriveIntakeSchema(domain: string): IntakeSchema | undefined {
  let pb;
  try {
    pb = getPlaybook(domain);
  } catch {
    return undefined;
  }
  const fields: IntakeField[] = [];
  collectFields(pb.extraction.jsonSchema as any, "", true, "", fields);
  if (!fields.length) return undefined;
  const subject = pb.label.replace(/^UK\s+/i, "").replace(/\s*\(.*\)$/, "").trim();
  return {
    domain,
    title: `Tell us about your ${subject} issue`,
    intro: "A few questions so we can work out your options and the dates that matter. Anything filled in from your documents can be edited.",
    fields,
  };
}

/** Hand-authored schema if present, else one derived from the playbook. */
export function getIntakeSchema(domain: string): IntakeSchema | undefined {
  if (INTAKE_SCHEMAS[domain]) return INTAKE_SCHEMAS[domain];
  if (domain in PLAYBOOKS) return deriveIntakeSchema(domain);
  return undefined;
}
