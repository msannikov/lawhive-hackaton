/**
 * Quote-then-cite validator (spec §3.8) — DETERMINISTIC. This is code, never a
 * prompt: verification is never delegated to the model.
 *
 * For each claim the model emits, its `verbatim_quote` must be a normalized
 * substring of the cached source text in the grounding store. Any failure ⇒ the
 * whole letter is rejected (the caller regenerates, then escalates). This is the
 * single mechanism that turns "the model said the law says X" into "the law,
 * as cached from legislation.gov.uk, demonstrably contains X."
 */
import { getChunk, findNormalized } from "./grounding";
import { ALLOWED_CLAIMS, allClaimsInRegistry } from "./registry";
import type { EmitLetter, GroundedClaim, LegalSourceChunk } from "./models";

export interface ValidationFailure {
  claim_id: string;
  source_id: string;
  reason: string;
}

export interface ValidationResult {
  ok: boolean;
  claims: GroundedClaim[];
  failures: ValidationFailure[];
}

function toGroundedClaim(
  claim: EmitLetter["claims"][number],
  chunk: LegalSourceChunk | undefined,
  verified: boolean,
  matched_offset: number,
): GroundedClaim {
  // uri/citation are authoritative from the store/registry, never from the model.
  const entry = ALLOWED_CLAIMS[claim.claim_id];
  return {
    claim_id: claim.claim_id,
    rendered_sentence: claim.rendered_sentence,
    source_id: claim.source_id,
    uri: chunk?.uri ?? entry.uri,
    citation: chunk?.citation ?? entry.citation,
    verbatim_quote: claim.verbatim_quote,
    verified,
    matched_offset,
    source_text: chunk?.text ?? "",
  };
}

export function validateClaims(emit: EmitLetter): ValidationResult {
  const claims: GroundedClaim[] = [];
  const failures: ValidationFailure[] = [];

  // Defense in depth: a selected id outside the registry is itself a failure.
  if (!allClaimsInRegistry(emit.selected_claim_ids)) {
    failures.push({
      claim_id: emit.selected_claim_ids.join(","),
      source_id: "—",
      reason: "selected claim_id is outside the allowed-claims registry",
    });
  }

  for (const claim of emit.claims) {
    const chunk = getChunk(claim.source_id);

    if (!chunk) {
      failures.push({
        claim_id: claim.claim_id,
        source_id: claim.source_id,
        reason: "source_id not found in the grounding store",
      });
      claims.push(toGroundedClaim(claim, undefined, false, -1));
      continue;
    }

    const matched_offset = findNormalized(chunk.text, claim.verbatim_quote);
    const verified = matched_offset !== -1;
    if (!verified) {
      failures.push({
        claim_id: claim.claim_id,
        source_id: claim.source_id,
        reason: "verbatim_quote is not a substring of the cached source text",
      });
    }
    claims.push(toGroundedClaim(claim, chunk, verified, matched_offset));
  }

  const ok = failures.length === 0 && claims.length > 0 && claims.every((c) => c.verified);
  return { ok, claims, failures };
}
