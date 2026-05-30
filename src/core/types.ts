/**
 * Domain-agnostic core types shared by every playbook.
 *
 * A "playbook" encapsulates one legal use case (deposit return, employment
 * termination, …): what to extract from documents, how to validate it, and how
 * to map it to a toolset. The orchestrator (`evaluateCase`) and the extraction
 * providers know only these generic types — never a specific domain.
 */

import type { Schema } from "@google/generative-ai";

/** Calendar date in `YYYY-MM-DD` form. */
export type ISODate = string;

/* ------------------------------------------------------------------ *
 * Input: unstructured documents
 * ------------------------------------------------------------------ */

export interface DocumentInput {
  name: string;
  kind: "pdf" | "image";
  mediaType: "application/pdf" | "image/png" | "image/jpeg";
  base64: string;
}

/** Facts the documents can't contain (or the caller already knows). */
export interface CaseContext {
  evaluationDate?: string;
  [key: string]: string | undefined;
}

/** The real, unstructured input to the system. */
export interface CaseInput {
  documents: DocumentInput[];
  /** Which playbook to run. Defaults to the registry default. */
  domain?: string;
  context?: CaseContext;
}

/* ------------------------------------------------------------------ *
 * Output: tools + assessment
 * ------------------------------------------------------------------ */

/** Free-form category label (each playbook defines its own set). */
export type ToolCategory = string;

/**
 * A single tool the user can act on. Every tool carries a concrete next action
 * and a concrete deadline date.
 */
export interface Tool {
  id: string;
  title: string;
  category: ToolCategory;
  nextAction: string;
  deadline: Date;
  deadlineBasis: string;
  legalBasis?: string;
  priority: number;
  documentTemplate?: string;
}

/**
 * Negotiation posture — how close the user is to the irreversible decision
 * (court / lawyer). The whole system is built to keep this at `self_serve` /
 * `monitor` and only reach `escalate` when information-gathering is exhausted.
 */
export type EscalationLevel = "self_serve" | "monitor" | "escalate";

/** The decision gate: should the user bring in a human lawyer now? */
export interface EscalationSignal {
  level: EscalationLevel;
  /** True iff level === "escalate". */
  recommend: boolean;
  reason: string;
  /** Which conditions fired / are being watched. */
  triggers: string[];
}

/**
 * The single recommended move for THIS round. The full arsenal stays in
 * `tools`; this just points at what to do next and frames WHY in negotiation
 * terms (what information the move is meant to surface).
 */
export interface NextMove {
  toolId: string;
  title: string;
  rationale: string;
  deadline: Date;
}

/** The rules-engine result for a case (produced by `playbook.assess`). */
export interface CaseAssessment {
  /** Domain-specific branch id (string so it's open across playbooks). */
  branch: string;
  branchLabel: string;
  summary: string;
  reasoning: string[];
  keyDates: Record<string, string>;
  /** The full arsenal — every tool with its deadline ("when to fire it"). */
  tools: Tool[];
  /** The one move recommended for this round (negotiation framing). */
  nextMove?: NextMove;
  /** Decision gate: self-serve vs monitor vs escalate to a human lawyer. */
  escalation: EscalationSignal;
}

/* ------------------------------------------------------------------ *
 * Extraction
 * ------------------------------------------------------------------ */

export interface FieldEvidence {
  field: string;
  value?: string | number | boolean | null;
  source: string;
  confidence?: number;
}

/** What the VLM should extract, expressed once per provider format. */
export interface ExtractionSpec {
  instructions: string;
  /** Claude tool `input_schema` (JSON Schema). */
  jsonSchema: Record<string, unknown>;
  /** Gemini `responseSchema`. */
  geminiSchema: Schema;
}

/** Raw model output for a case (un-normalised). Playbooks normalise it. */
export interface RawExtraction {
  raw: any;
  evidence: FieldEvidence[];
  provider: string;
  warnings: string[];
}

/** Pluggable VLM backend. It returns RAW facts; the playbook normalises them. */
export interface ExtractionProvider {
  readonly name: string;
  extract(input: CaseInput, spec: ExtractionSpec): Promise<RawExtraction>;
}

/* ------------------------------------------------------------------ *
 * Playbook (the extension seam)
 * ------------------------------------------------------------------ */

/**
 * One legal use case. Add a new domain by implementing this interface and
 * registering it — the orchestrator, providers and validation are unchanged.
 */
export interface Playbook<TCase = unknown> {
  id: string;
  label: string;
  /** What to pull out of the documents. */
  extraction: ExtractionSpec;
  /** Raw model output → validated, typed domain case (throws on bad data). */
  normalize(raw: any, input: CaseInput, warnings: string[]): TCase;
  /** Domain case → branch + toolset (pure, deterministic). */
  assess(domainCase: TCase): CaseAssessment;
}

/** Full document-driven result: the assessment plus extraction provenance. */
export interface DomainAssessment extends CaseAssessment {
  domain: string;
  extractedCase: unknown;
  extraction: {
    provider: string;
    evidence: FieldEvidence[];
    warnings: string[];
  };
}
