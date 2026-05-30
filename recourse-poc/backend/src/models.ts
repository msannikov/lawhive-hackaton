/**
 * Zod schemas = the single source of truth for every data shape in the system.
 * These mirror spec §5 (Data models). Zod gives us BOTH runtime validation
 * (request bodies, fixture loads, and — critically — the model's tool output)
 * AND static TypeScript types via `z.infer`, so there is one definition, not two.
 *
 * Two pragmatic extensions beyond §5, required to actually render a letter:
 *   - party/property fields (tenant_name, tenant_address, property_address):
 *     a Letter Before Claim is unsendable without the claimant's details.
 *   - GroundedClaim gains `citation` + `source_text`: so the provenance drawer
 *     can render the highlight without a second round-trip.
 */
import { z } from "zod";

/** The six propositions the generator is allowed to assert (§6). */
export const CLAIM_IDS = ["R1", "R2", "R4", "R5", "R6", "R7"] as const;
export const ClaimIdSchema = z.enum(CLAIM_IDS);
export type ClaimId = z.infer<typeof ClaimIdSchema>;

// ── DepositCase — the case-state object / "intake" output ─────────────────────
export const DepositCaseSchema = z.object({
  deposit_amount: z.number().positive(), // pounds, e.g. 980.00
  date_deposit_paid: z.string(), // ISO yyyy-mm-dd
  tenancy_type: z.enum(["AST", "other"]),
  country: z.enum(["England", "Wales", "other"]),
  tenancy_start_date: z.string(),
  protected_status: z.enum(["yes", "no", "unknown"]),
  prescribed_info_received: z.enum(["yes", "no", "unknown"]),
  tenancy_ended: z.boolean(),
  tenancy_end_date: z.string().nullable(),
  deposit_returned: z.boolean(),
  amount_returned: z.number().nonnegative(),
  renewals_or_rollovers: z.enum(["none", "one", "multiple"]),
  landlord_or_agent: z.enum(["landlord", "agent"]),
  landlord_name: z.string(),
  landlord_address: z.string(),
  // Party/property fields (extension beyond §5 — needed to render the letter).
  tenant_name: z.string(),
  tenant_address: z.string(),
  property_address: z.string(),
  unknown_slots: z.array(z.string()).default([]),
});
export type DepositCase = z.infer<typeof DepositCaseSchema>;

// ── Engine outputs ────────────────────────────────────────────────────────────
export const EligibilityResultSchema = z.object({
  in_scope: z.boolean(),
  breach: z.boolean(),
  breach_types: z.array(z.string()),
  reasons: z.array(z.string()), // R-codes
});
export type EligibilityResult = z.infer<typeof EligibilityResultSchema>;

export const QuantumResultSchema = z.object({
  deposit_return: z.number(),
  penalty_min: z.number(),
  penalty_max: z.number(),
  tenancy_count: z.number().int(),
  basis: z.array(z.string()),
  discretion_note_ref: z.string(),
});
export type QuantumResult = z.infer<typeof QuantumResultSchema>;

export const DeadlineStatusSchema = z.enum(["ample", "watch", "urgent", "critical"]);
export type DeadlineStatus = z.infer<typeof DeadlineStatusSchema>;

export const DeadlineResultSchema = z.object({
  limitation_expiry: z.string(),
  days_remaining: z.number().int(),
  status: DeadlineStatusSchema,
  lbc_response_deadline: z.string(),
  uncertainty_flag: z.boolean(),
  basis: z.array(z.string()),
});
export type DeadlineResult = z.infer<typeof DeadlineResultSchema>;

// ── Grounding store ─────────────────────────────────────────────────────────
export const LegalSourceChunkSchema = z.object({
  source_id: z.string(),
  citation: z.string(),
  uri: z.string(),
  text: z.string(), // canonical verbatim string the validator matches against
  in_force_date: z.string().nullable(),
  retrieved_at: z.string(),
});
export type LegalSourceChunk = z.infer<typeof LegalSourceChunkSchema>;

// ── Allowed-claims registry entry (§6) ──────────────────────────────────────
// `verbatim_anchor` is the canonical, build-time-verified quote for this claim.
// It is authored by us (never by the model) and proven to be a substring of the
// grounding store by the fetch script. The offline fixture reuses it; live
// generation must independently produce a quote the validator can confirm.
export const RegistryEntrySchema = z.object({
  claim_id: ClaimIdSchema,
  proposition: z.string(),
  source_id: z.string(),
  citation: z.string(),
  uri: z.string(),
  verbatim_anchor: z.string(),
});
export type RegistryEntry = z.infer<typeof RegistryEntrySchema>;

// ── Generation: the emit_letter tool the model is forced to call (§3.7) ──────
// The model SELECTS claim_ids and FILLS narrative slots. It never asserts a
// proposition outside the registry and never computes a number.
export const EmitLetterSchema = z.object({
  selected_claim_ids: z.array(ClaimIdSchema),
  letter_sections: z.object({
    intro: z.string(),
    facts: z.string(),
    breach: z.string(),
    claim: z.string(),
    adr: z.string(),
    next_steps: z.string(),
  }),
  claims: z.array(
    z.object({
      claim_id: ClaimIdSchema,
      rendered_sentence: z.string(),
      source_id: z.string(),
      verbatim_quote: z.string(),
    }),
  ),
});
export type EmitLetter = z.infer<typeof EmitLetterSchema>;

// ── GroundedClaim (post-validation) ──────────────────────────────────────────
export const GroundedClaimSchema = z.object({
  claim_id: ClaimIdSchema,
  rendered_sentence: z.string(),
  source_id: z.string(),
  uri: z.string(),
  citation: z.string(), // extension: for the drawer
  verbatim_quote: z.string(),
  verified: z.boolean(),
  matched_offset: z.number().int(),
  source_text: z.string(), // extension: normalized chunk, so the drawer highlights in-place
});
export type GroundedClaim = z.infer<typeof GroundedClaimSchema>;

// ── LetterArtifact ────────────────────────────────────────────────────────────
export const LetterArtifactSchema = z.object({
  body_markdown: z.string(),
  provenance_map: z.array(GroundedClaimSchema),
  enclosures: z.array(z.string()),
  deadline: DeadlineResultSchema,
});
export type LetterArtifact = z.infer<typeof LetterArtifactSchema>;

// ── EscalationDecision (§3.10) ────────────────────────────────────────────────
// `kind` makes the three terminal outcomes explicit for routing.
export const EscalationDecisionSchema = z.object({
  kind: z.enum(["proceed", "escalate", "refuse"]),
  escalate: z.boolean(),
  reasons: z.array(z.string()),
  handoff_package_id: z.string().nullable(),
});
export type EscalationDecision = z.infer<typeof EscalationDecisionSchema>;

// ── API request/response ──────────────────────────────────────────────────────
export const GenerateRequestSchema = z.object({
  case_id: z.string(),
});
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
