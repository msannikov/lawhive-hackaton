import { useState } from "react";
import type { LandlordResponse, LogEvent, NegStage } from "../types";
import { formatDate } from "../lib/date";
import { negCopy, cap, type NegCopy } from "../lib/negCopy";
import ResponseLogger from "./ResponseLogger";

export interface NegotiationApi {
  stage: NegStage;
  events: LogEvent[];
  awaiting: { since: string; dueBy: string } | null;
  resolved: { at: string; note?: string } | null;
  domain: string;
  onSent: () => void;
  onResponse: (category: LandlordResponse, note?: string) => void;
  onNoResponse: () => void;
  onAdrUnresolved: () => void;
  onResolve: (note?: string) => void;
}

const STAGE_LABEL: Record<NegStage, string> = {
  initial: "Getting started",
  post_letter: "After your letter",
  post_adr: "After ADR",
};

export default function NegotiationPanel({ neg }: { neg: NegotiationApi }) {
  const [logging, setLogging] = useState(false);
  const c = negCopy(neg.domain);

  if (neg.resolved) {
    return (
      <div className="neg-panel">
        <div className="neg-status tone-ok">
          <strong>✓ Resolved</strong>
          <span>You marked {c.resolvedStatus} on {formatDate(neg.resolved.at)}.</span>
        </div>
        {neg.resolved.note && <p className="note">{neg.resolved.note}</p>}
        <History events={neg.events} />
      </div>
    );
  }

  return (
    <div className="neg-panel">
      <div className="neg-head">
        <div>
          <h3>Keep your case moving</h3>
          <p className="neg-status-line">{describe(neg, c)}</p>
        </div>
        <span className={"neg-stage stage-" + neg.stage}>{STAGE_LABEL[neg.stage]}</span>
      </div>

      {neg.awaiting && (
        <div className="awaiting-prompt">
          <strong>Has {c.counterparty} replied?</strong>
          <div className="awaiting-actions">
            <button type="button" className="primary-btn" onClick={() => setLogging(true)}>
              Yes — log their reply
            </button>
            <button type="button" className="ghost-btn" onClick={neg.onNoResponse}>
              <span className="ico">🔇</span>
              <span>No reply by {formatDate(neg.awaiting.dueBy)}</span>
            </button>
          </div>
        </div>
      )}

      <div className="neg-actions">
        {neg.stage === "initial" && !neg.awaiting && (
          <button type="button" className="ghost-btn" onClick={neg.onSent}>
            <span className="ico">✉️</span>
            <span>I've sent the letter</span>
          </button>
        )}
        {!neg.awaiting && (
          <button type="button" className="ghost-btn" onClick={() => setLogging(true)}>
            <span className="ico">💬</span>
            <span>Tell us what they said</span>
          </button>
        )}
        <button type="button" className="ghost-btn" onClick={neg.onNoResponse}>
          <span className="ico">🔇</span>
          <span>{cap(c.counterparty)}'s gone quiet</span>
        </button>
        <button type="button" className="ghost-btn" onClick={neg.onAdrUnresolved}>
          <span className="ico">⚖️</span>
          <span>ADR didn't work</span>
        </button>
        <button type="button" className="ghost-btn good" onClick={() => neg.onResolve()}>
          <span className="ico">🎉</span>
          <span>{c.resolvedLabel}</span>
        </button>
      </div>

      {logging && (
        <ResponseLogger
          domain={neg.domain}
          onSubmit={(cat, note) => {
            neg.onResponse(cat, note);
            setLogging(false);
          }}
          onCancel={() => setLogging(false)}
        />
      )}

      <History events={neg.events} />
    </div>
  );
}

function describe(neg: NegotiationApi, c: NegCopy): string {
  if (neg.awaiting) {
    return `You sent your letter on ${formatDate(neg.awaiting.since)}. Give ${c.counterparty} until ${formatDate(
      neg.awaiting.dueBy,
    )} to respond, then log what happened.`;
  }
  switch (neg.stage) {
    case "initial":
      return `Send the recommended letter, then come back and log what ${c.counterparty} does — the plan updates around their response.`;
    case "post_letter":
      return "Your letter step is done. The plan below reflects their response.";
    case "post_adr":
      return "ADR is exhausted — the plan below reflects the next step.";
  }
}

function History({ events }: { events: LogEvent[] }) {
  if (!events.length) return null;
  return (
    <div className="neg-history">
      <h4>Case history</h4>
      <ol>
        {events.map((e) => (
          <li key={e.id} className={"hist-" + (e.tone ?? "neutral")}>
            <span className="hist-date">{formatDate(e.at)}</span>
            <span className="hist-body">
              <span className="hist-title">{e.title}</span>
              {e.detail && <span className="hist-detail">{e.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
