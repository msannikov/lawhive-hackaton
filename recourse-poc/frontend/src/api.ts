import type {
  CaseSummary,
  GenerateResponse,
  Taxonomy,
  IntakeSchema,
  CaseAssessment,
  Facts,
  DocInput,
  ExtractResult,
  ClassifyResult,
} from "./types";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      /* ignore */
    }
    throw new Error(`Request failed (${res.status}) ${detail}`);
  }
  return res.json() as Promise<T>;
}

const postJson = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// --- Funnel ---
export async function fetchTaxonomy(): Promise<Taxonomy> {
  return jsonOrThrow(await fetch("/api/taxonomy"));
}

export async function fetchIntakeSchema(domain: string): Promise<IntakeSchema> {
  return jsonOrThrow(await fetch(`/api/playbooks/${domain}/intake-schema`));
}

// --- Assessment ---
export async function assess(domain: string, facts: Facts, context?: Record<string, string>): Promise<CaseAssessment> {
  return jsonOrThrow(await postJson("/api/assess", { domain, facts, context }));
}

export async function extractFacts(domain: string, documents: DocInput[]): Promise<ExtractResult> {
  return jsonOrThrow(await postJson(`/api/playbooks/${domain}/extract`, { documents }));
}

// --- Deposit grounded letter (same shape as /api/generate) ---
export async function fetchDepositLetter(
  facts: Facts,
  overrides?: Record<string, unknown>,
  context?: Record<string, string>,
): Promise<GenerateResponse> {
  return jsonOrThrow(await postJson("/api/playbooks/deposit_return/letter", { facts, overrides, context }));
}

// --- Negotiation: classify a pasted landlord reply ---
export async function classifyResponse(domain: string, message: string): Promise<ClassifyResult> {
  return jsonOrThrow(await postJson(`/api/playbooks/${domain}/classify-response`, { message }));
}

// --- Demo presets (back-compat) ---
export async function fetchCases(): Promise<CaseSummary[]> {
  return jsonOrThrow(await fetch("/api/cases"));
}

export async function generate(caseId: string): Promise<GenerateResponse> {
  return jsonOrThrow(await postJson("/api/generate", { case_id: caseId }));
}
