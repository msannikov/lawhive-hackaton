import type { CaseSummary, GenerateResponse } from "./types";

export async function fetchCases(): Promise<CaseSummary[]> {
  const res = await fetch("/api/cases");
  if (!res.ok) throw new Error(`Failed to load cases (${res.status})`);
  return res.json();
}

export async function generate(caseId: string): Promise<GenerateResponse> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ case_id: caseId }),
  });
  return res.json();
}
