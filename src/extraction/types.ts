/**
 * Types for the extraction layer: unstructured documents in, a structured
 * (and provenance-tagged) TenantCase out.
 */

import type { TenantCase, CaseAssessment } from "../toolset/types.ts";

/** A single uploaded document the user submitted. */
export interface DocumentInput {
  /** Filename or label, surfaced to the model and in provenance. */
  name: string;
  /** PDFs go to the document channel; PNG/JPEG to the vision channel. */
  kind: "pdf" | "image";
  mediaType: "application/pdf" | "image/png" | "image/jpeg";
  /** Base64-encoded file contents. */
  base64: string;
}

/** The real, unstructured input to the system. */
export interface CaseInput {
  documents: DocumentInput[];
  /**
   * Optional facts the documents can't contain (or that the caller already
   * knows) — e.g. how the landlord has responded, or "today" for deadlines.
   * These override anything the model infers.
   */
  context?: {
    landlordResponse?: TenantCase["landlordResponse"];
    evaluationDate?: string;
    depositRequestDate?: string;
  };
}

/** Where a given fact came from, for auditability. */
export interface FieldEvidence {
  field: string;
  value: string | number | boolean | null;
  source: string; // e.g. "tenancy_agreement.pdf, Schedule 1"
  confidence?: number; // 0..1 if the model supplies it
}

/** What a provider returns: the facts plus how it found them. */
export interface ExtractionResult {
  tenantCase: TenantCase;
  evidence: FieldEvidence[];
  provider: string;
  /** Non-fatal issues (e.g. a coerced date, a missing optional field). */
  warnings: string[];
}

/** Pluggable VLM backend. Claude, Gemini and Mock all implement this. */
export interface ExtractionProvider {
  readonly name: string;
  extract(input: CaseInput): Promise<ExtractionResult>;
}

/** The full document-driven result: extraction + the legal assessment. */
export interface DocumentAssessment extends CaseAssessment {
  /** The TenantCase the VLM extracted and the validator normalised. */
  extractedCase: TenantCase;
  extraction: {
    provider: string;
    evidence: FieldEvidence[];
    warnings: string[];
  };
}
