/**
 * The allowed-claims registry (spec §6) — the anti-hallucination core.
 *
 * The generator may assert ONLY these propositions, each pre-bound to a source.
 * A new legal claim cannot enter a letter without first being added here AND
 * having its verbatim anchor verified against the grounding store. This converts
 * "open legal generation" into "selection from a vetted set."
 *
 * Note the two distinct s.214 provisions:
 *   R4 → s.214(1)(a)  "may apply to the county court"   (source_id ha2004-s214-1a)
 *   R5 → s.214(1A)    "also applies … tenancy has ended" (source_id ha2004-s214-1A)
 * They are different subsections; the fetch script extracts each separately.
 */
import type { ClaimId, RegistryEntry } from "./models";

const HA2004_S213 = "https://www.legislation.gov.uk/ukpga/2004/34/section/213";
const HA2004_S214 = "https://www.legislation.gov.uk/ukpga/2004/34/section/214";

export const ALLOWED_CLAIMS: Record<ClaimId, RegistryEntry> = {
  R1: {
    claim_id: "R1",
    proposition: "The deposit must be protected in an authorised scheme within 30 days of receipt.",
    source_id: "ha2004-s213-3",
    citation: "Housing Act 2004, s.213(3)",
    uri: HA2004_S213,
    verbatim_anchor:
      "the initial requirements of an authorised scheme must be complied with by the landlord in relation to the deposit within the period of 30 days beginning with the date on which it is received",
  },
  R2: {
    claim_id: "R2",
    proposition: "The prescribed information must be given to the tenant within 30 days.",
    source_id: "ha2004-s213-6",
    citation: "Housing Act 2004, s.213(6)",
    uri: HA2004_S213,
    verbatim_anchor:
      "within the period of 30 days beginning with the date on which the deposit is received by the landlord",
  },
  R4: {
    claim_id: "R4",
    proposition: "A tenant may apply to the county court where s.213(3) or (6) is breached.",
    source_id: "ha2004-s214-1a",
    citation: "Housing Act 2004, s.214(1)(a)",
    uri: HA2004_S214,
    verbatim_anchor: "that section 213(3) or (6) has not been complied with in relation to the deposit",
  },
  R5: {
    claim_id: "R5",
    proposition: "The claim applies even where the tenancy has ended.",
    source_id: "ha2004-s214-1A",
    citation: "Housing Act 2004, s.214(1A)",
    uri: HA2004_S214,
    verbatim_anchor: "Subsection (1) also applies in a case where the tenancy has ended",
  },
  R6: {
    claim_id: "R6",
    proposition: "The court may order repayment of the deposit within 14 days of the order.",
    source_id: "ha2004-s214-3A",
    citation: "Housing Act 2004, s.214(3A)",
    uri: HA2004_S214,
    verbatim_anchor:
      "to repay all or part of it to the applicant within the period of 14 days beginning with the date of the making of the order",
  },
  R7: {
    claim_id: "R7",
    proposition:
      "The court must order the landlord to pay a sum of not less than the deposit and not more than three times the deposit, within 14 days.",
    source_id: "ha2004-s214-4",
    citation: "Housing Act 2004, s.214(4)",
    uri: HA2004_S214,
    verbatim_anchor:
      "not less than the amount of the deposit and not more than three times the amount of the deposit within the period of 14 days",
  },
};

/** True if every selected id is a known registry claim (used by the validator). */
export function allClaimsInRegistry(ids: string[]): boolean {
  return ids.every((id) => id in ALLOWED_CLAIMS);
}
