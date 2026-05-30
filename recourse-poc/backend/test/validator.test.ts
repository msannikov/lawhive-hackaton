import { describe, it, expect } from "vitest";
import { validateClaims } from "../src/validator";
import { ALLOWED_CLAIMS } from "../src/registry";
import type { EmitLetter } from "../src/models";

const EMPTY_SECTIONS = { intro: "", facts: "", breach: "", claim: "", adr: "", next_steps: "" };

function emit(claims: EmitLetter["claims"]): EmitLetter {
  return {
    selected_claim_ids: claims.map((c) => c.claim_id),
    letter_sections: EMPTY_SECTIONS,
    claims,
  };
}

describe("quote-then-cite validator (§3.8)", () => {
  it("ACCEPTS a real quote that is a substring of the cached statute", () => {
    const r = validateClaims(
      emit([
        {
          claim_id: "R7",
          rendered_sentence: "The court must order a penalty of one to three times the deposit.",
          source_id: "ha2004-s214-4",
          verbatim_quote: ALLOWED_CLAIMS.R7.verbatim_anchor,
        },
      ]),
    );
    expect(r.ok).toBe(true);
    expect(r.claims[0]!.verified).toBe(true);
    expect(r.claims[0]!.matched_offset).toBeGreaterThanOrEqual(0);
    expect(r.failures).toHaveLength(0);
  });

  // THE DEMO EXHIBIT: a fabricated quote must be blocked, not shipped.
  it("REJECTS a fabricated quote not present in the source (anti-hallucination)", () => {
    const r = validateClaims(
      emit([
        {
          claim_id: "R7",
          rendered_sentence: "The court must order a penalty of FIVE times the deposit.",
          source_id: "ha2004-s214-4",
          verbatim_quote: "a sum of money not less than five times the amount of the deposit",
        },
      ]),
    );
    expect(r.ok).toBe(false);
    expect(r.claims[0]!.verified).toBe(false);
    expect(r.failures[0]!.reason).toMatch(/not a substring/i);
  });

  it("REJECTS a claim citing a source_id that is not in the grounding store", () => {
    const r = validateClaims(
      emit([
        {
          claim_id: "R7",
          rendered_sentence: "Citing a section we never cached.",
          source_id: "ha2004-s999",
          verbatim_quote: ALLOWED_CLAIMS.R7.verbatim_anchor,
        },
      ]),
    );
    expect(r.ok).toBe(false);
    expect(r.failures[0]!.reason).toMatch(/not found in the grounding store/i);
  });

  it("is robust to whitespace/case differences (normalization)", () => {
    const r = validateClaims(
      emit([
        {
          claim_id: "R5",
          rendered_sentence: "The claim applies even after the tenancy has ended.",
          source_id: "ha2004-s214-1A",
          // Same words as the anchor but UPPER CASE with extra   spaces.
          verbatim_quote: "SUBSECTION (1)   ALSO  APPLIES in a case WHERE the tenancy has ENDED",
        },
      ]),
    );
    expect(r.ok).toBe(true);
    expect(r.claims[0]!.verified).toBe(true);
  });
});
