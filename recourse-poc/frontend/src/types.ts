// Mirrors the backend response shapes (backend/src/models.ts, taxonomy.ts,
// intakeSchemas.ts, and the team engine's core/types.ts). Hand-synced for the POC.

export interface CaseSummary {
  id: string;
  label: string;
  blurb: string;
}

export interface GroundedClaim {
  claim_id: string;
  rendered_sentence: string;
  source_id: string;
  uri: string;
  citation: string;
  verbatim_quote: string;
  verified: boolean;
  matched_offset: number;
  source_text: string;
}

export interface DeadlineResult {
  limitation_expiry: string;
  days_remaining: number;
  status: "ample" | "watch" | "urgent" | "critical";
  lbc_response_deadline: string;
  uncertainty_flag: boolean;
  basis: string[];
}

export interface QuantumResult {
  deposit_return: number;
  penalty_min: number;
  penalty_max: number;
  tenancy_count: number;
  basis: string[];
  discretion_note_ref: string;
}

export interface EligibilityResult {
  in_scope: boolean;
  breach: boolean;
  breach_types: string[];
  reasons: string[];
}

export interface LetterArtifact {
  body_markdown: string;
  provenance_map: GroundedClaim[];
  enclosures: string[];
  deadline: DeadlineResult;
}

export interface HandoffPackage {
  id: string;
  kind: "escalate" | "refuse";
  reasons: string[];
  case: Record<string, unknown>;
  eligibility: EligibilityResult;
  quantum: QuantumResult | null;
  deadline: DeadlineResult;
  evidence_checklist: string[];
  solicitor_summary: string;
}

export type GenerateResponse =
  | {
      outcome: "letter";
      letter: LetterArtifact;
      engines: { eligibility: EligibilityResult; quantum: QuantumResult };
      meta: { source: string; validator: string; model_id: string | null };
    }
  | {
      outcome: "escalate" | "refuse";
      escalation: { kind: string; escalate: boolean; reasons: string[]; handoff_package_id: string };
      handoff: HandoffPackage;
    };

// ── Funnel taxonomy ──────────────────────────────────────────────────────────
export type LeafStatus = "live" | "coming_soon";

export interface TaxonomyLeaf {
  id: string;
  label: string;
  blurb?: string;
  domain?: string;
  status: LeafStatus;
}

export interface TaxonomyArea {
  id: string;
  label: string;
  icon: string;
  blurb: string;
  status: LeafStatus;
  subAreas: TaxonomyLeaf[];
}

export interface Taxonomy {
  areas: TaxonomyArea[];
}

// ── Intake schema (drives the guided form) ───────────────────────────────────
export type IntakeFieldType = "text" | "number" | "money" | "date" | "boolean" | "select" | "textarea";

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

// ── Assessment (from the team engine, deadlines serialised to YYYY-MM-DD) ─────
export type ToolCategory = "verify" | "evidence" | "letter" | "negotiation" | "adr" | "court" | "chase" | string;

export interface Tool {
  id: string;
  title: string;
  category: ToolCategory;
  nextAction: string;
  deadline: string; // YYYY-MM-DD
  deadlineBasis: string;
  legalBasis?: string;
  priority: number;
  documentTemplate?: string;
}

export type EscalationLevel = "self_serve" | "monitor" | "escalate";

export interface EscalationSignal {
  level: EscalationLevel;
  recommend: boolean;
  reason: string;
  triggers: string[];
}

export interface NextMove {
  toolId: string;
  title: string;
  rationale: string;
  deadline: string;
}

export interface CaseAssessment {
  domain?: string;
  branch: string;
  branchLabel: string;
  summary: string;
  reasoning: string[];
  keyDates: Record<string, string>;
  tools: Tool[];
  nextMove?: NextMove;
  escalation: EscalationSignal;
  warnings?: string[];
  extractedCase?: unknown;
}

// Facts collected at intake (nested object matching the playbook's raw shape).
export type Facts = Record<string, unknown>;

/** A document uploaded for VLM extraction. */
export interface DocInput {
  name: string;
  kind: "pdf" | "image";
  mediaType: "application/pdf" | "image/png" | "image/jpeg";
  base64: string;
}

export interface ExtractResult {
  facts: Facts;
  evidence: Array<{ field: string; value?: unknown; source: string }>;
  warnings: string[];
  provider: string;
}
