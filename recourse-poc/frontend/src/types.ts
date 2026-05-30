// Mirrors the backend response shapes (backend/src/models.ts). Kept hand-synced
// for the POC; in a fuller build these would be shared from one package.

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
