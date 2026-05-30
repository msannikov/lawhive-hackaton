import { Fragment, type ReactNode } from "react";
import type { GroundedClaim, LetterArtifact } from "../types";

interface Props {
  letter: LetterArtifact;
  meta: { source: string; validator: string; model_id: string | null };
  onClaimClick: (c: GroundedClaim) => void;
  activeClaimId: string | null;
}

export default function Letter({ letter, meta, onClaimClick, activeClaimId }: Props) {
  const verified = letter.provenance_map.filter((c) => c.verified).length;
  const total = letter.provenance_map.length;

  return (
    <article className="letter-pane">
      <div className="verify-bar">
        <span className="tick">✓</span>
        <span>
          {verified}/{total} legal statements verified against primary legislation
        </span>
        <span className="source-chip">
          {meta.source === "fixture" ? "recorded" : "live"} · {meta.model_id ?? "offline"}
        </span>
      </div>
      <div className="letter">
        {renderMarkdown(letter.body_markdown, letter.provenance_map, onClaimClick, activeClaimId)}
      </div>
    </article>
  );
}

// ── Minimal markdown renderer for the subset the assembler emits, with grounded
//    sentences wrapped as clickable provenance spans. ──────────────────────────

type Segment = { text: string; claim?: GroundedClaim };

function splitByClaims(text: string, claims: GroundedClaim[]): Segment[] {
  const hits = claims
    .map((c) => ({ idx: text.indexOf(c.rendered_sentence), len: c.rendered_sentence.length, claim: c }))
    .filter((h) => h.idx !== -1)
    .sort((a, b) => a.idx - b.idx);

  const out: Segment[] = [];
  let cur = 0;
  for (const h of hits) {
    if (h.idx < cur) continue; // skip overlaps
    if (h.idx > cur) out.push({ text: text.slice(cur, h.idx) });
    out.push({ text: text.slice(h.idx, h.idx + h.len), claim: h.claim });
    cur = h.idx + h.len;
  }
  if (cur < text.length) out.push({ text: text.slice(cur) });
  if (out.length === 0) out.push({ text });
  return out;
}

function parseBold(str: string, keyBase: string): ReactNode[] {
  return str.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? <strong key={`${keyBase}-b${i}`}>{part}</strong> : <Fragment key={`${keyBase}-t${i}`}>{part}</Fragment>,
  );
}

function inline(
  text: string,
  claims: GroundedClaim[],
  onClick: (c: GroundedClaim) => void,
  activeId: string | null,
  keyBase: string,
): ReactNode[] {
  return splitByClaims(text, claims).map((seg, i) => {
    if (seg.claim) {
      const c = seg.claim;
      const cls = "prov" + (c.verified ? " ok" : " bad") + (activeId === c.claim_id ? " active" : "");
      return (
        <button key={`${keyBase}-c${i}`} className={cls} onClick={() => onClick(c)} title={c.citation}>
          {seg.text}
          <sup className="prov-mark">{c.verified ? "✓" : "✗"}</sup>
        </button>
      );
    }
    return <Fragment key={`${keyBase}-s${i}`}>{parseBold(seg.text, `${keyBase}-s${i}`)}</Fragment>;
  });
}

function renderMarkdown(
  md: string,
  claims: GroundedClaim[],
  onClick: (c: GroundedClaim) => void,
  activeId: string | null,
): ReactNode[] {
  const lines = md.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(<h2 key={key++}>{inline(line.slice(3), claims, onClick, activeId, `h${key}`)}</h2>);
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push(<h3 key={key++}>{inline(line.slice(4), claims, onClick, activeId, `h${key}`)}</h3>);
      i++;
      continue;
    }
    if (line.trim() === "---") {
      blocks.push(<hr key={key++} />);
      i++;
      continue;
    }
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i] ?? "").startsWith("- ")) {
        items.push((lines[i] ?? "").slice(2));
        i++;
      }
      blocks.push(
        <ul key={key++}>
          {items.map((it, idx) => (
            <li key={idx}>{inline(it, claims, onClick, activeId, `li${key}-${idx}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    // Paragraph: gather consecutive non-structural lines, joined with <br/>.
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i] ?? "";
      if (l.trim() === "" || l.startsWith("#") || l.trim() === "---" || l.startsWith("- ")) break;
      para.push(l);
      i++;
    }
    blocks.push(
      <p key={key++}>
        {para.map((pl, idx) => (
          <Fragment key={idx}>
            {inline(pl, claims, onClick, activeId, `p${key}-${idx}`)}
            {idx < para.length - 1 ? <br /> : null}
          </Fragment>
        ))}
      </p>,
    );
  }
  return blocks;
}
