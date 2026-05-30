import type { ReactNode } from "react";
import type { GroundedClaim } from "../types";

interface Props {
  claim: GroundedClaim | null;
  onClose: () => void;
}

/** Highlight the verified quote inside the full source text (case-insensitive). */
function highlight(source: string, quote: string): ReactNode {
  const idx = source.toLowerCase().indexOf(quote.toLowerCase());
  if (idx === -1) return source;
  return (
    <>
      {source.slice(0, idx)}
      <mark>{source.slice(idx, idx + quote.length)}</mark>
      {source.slice(idx + quote.length)}
    </>
  );
}

export default function ProvenanceDrawer({ claim, onClose }: Props) {
  if (!claim) return null;
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Provenance">
        <button className="drawer-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className={"verdict " + (claim.verified ? "ok" : "bad")}>
          {claim.verified ? "✓ Verified against primary legislation" : "✗ Could not be verified"}
        </div>

        <h3>{claim.citation}</h3>
        <a className="uri" href={claim.uri} target="_blank" rel="noreferrer">
          {claim.uri}
        </a>
        <p className="claim-meta">
          Claim {claim.claim_id} · source <code>{claim.source_id}</code>
          {claim.verified ? ` · matched at offset ${claim.matched_offset}` : ""}
        </p>

        <h4>What the letter says</h4>
        <blockquote className="rendered">{claim.rendered_sentence}</blockquote>

        <h4>Source text — legislation.gov.uk</h4>
        <p className="source-text">{highlight(claim.source_text, claim.verbatim_quote)}</p>
      </aside>
    </>
  );
}
