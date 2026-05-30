import { useState } from "react";
import type { LandlordResponse, ClassifyResult } from "../types";
import { classifyResponse } from "../api";

const OPTIONS: { value: LandlordResponse; label: string }[] = [
  { value: "agrees_in_full", label: "Agreed to return in full" },
  { value: "disputes_deductions", label: "Wants deductions / disputes" },
  { value: "unknown", label: "Unclear" },
];

function labelFor(v: LandlordResponse): string {
  return v === "agrees_in_full"
    ? "Agreed in full"
    : v === "disputes_deductions"
      ? "Disputes / deductions"
      : v === "silent"
        ? "No response"
        : "Unclear";
}

interface Props {
  domain: string;
  onSubmit: (category: LandlordResponse, note?: string) => void;
  onCancel: () => void;
}

export default function ResponseLogger({ domain, onSubmit, onCancel }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ClassifyResult | null>(null);
  const [chosen, setChosen] = useState<LandlordResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function classify() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await classifyResponse(domain, text.trim());
      setResult(r);
      setChosen(r.landlordResponse);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="response-logger">
      <label htmlFor="reply">Paste the landlord's reply — we'll read it and route you</label>
      <textarea
        id="reply"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. I'll return your deposit minus £150 for cleaning…"
      />
      <div className="rl-row">
        <button type="button" className="ghost-btn" disabled={busy || !text.trim()} onClick={classify}>
          {busy ? "Reading…" : "Read it for me"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {result && (
        <p className="rl-result">
          Detected: <strong>{labelFor(result.landlordResponse)}</strong> — <em>{result.rationale}</em>{" "}
          <span className="source-chip">{result.source}</span>
        </p>
      )}

      <div className="rl-options">
        <span className="rl-or">{result ? "Confirm or change:" : "Or choose directly:"}</span>
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            className={"chip" + (chosen === o.value ? " on" : "")}
            onClick={() => setChosen(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="rl-actions">
        <button
          type="button"
          className="primary-btn"
          disabled={!chosen}
          onClick={() => chosen && onSubmit(chosen, text.trim() || undefined)}
        >
          Log this response →
        </button>
        <button type="button" className="ghost-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
