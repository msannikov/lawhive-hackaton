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

export const INTAKE_SCHEMAS: Record<string, IntakeSchema> = {
  deposit_return: DEPOSIT_RETURN_INTAKE,
};

export function getIntakeSchema(domain: string): IntakeSchema | undefined {
  return INTAKE_SCHEMAS[domain];
}
