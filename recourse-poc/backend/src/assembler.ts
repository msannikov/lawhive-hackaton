/**
 * Letter assembler + template (spec §3.9). Combines the validated claims and the
 * deterministic engine outputs into a PDPACP-compliant Letter Before Claim.
 *
 * Division of authority:
 *   - Narrative (intro/facts/breach/adr/next_steps) comes from the model.
 *   - The grounded legal sentences come from the validated claims (verbatim).
 *   - The FIGURES (deposit return, penalty range) and the response DATE are
 *     rendered here from QuantumResult/DeadlineResult — never from the model's
 *     prose — so the numbers in the letter are always the verified ones.
 *
 * Each claim's rendered_sentence is placed verbatim in the body so the frontend
 * can wrap it as a clickable provenance span.
 */
import type { DepositCase, GroundedClaim, QuantumResult, DeadlineResult, LetterArtifact, EmitLetter } from "./models";

const ENCLOSURES = [
  "Copy of the tenancy agreement (AST)",
  "Proof of deposit payment",
  "Scheme-check screenshots (DPS, MyDeposits, TDS)",
];

function gbp(n: number): string {
  return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function humanDate(iso: string): string {
  const p = iso.split("-").map(Number);
  return new Date(p[0] ?? 1970, (p[1] ?? 1) - 1, p[2] ?? 1).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function todayHuman(today: Date): string {
  return today.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function assembleLetter(
  c: DepositCase,
  claims: GroundedClaim[],
  quantum: QuantumResult,
  deadline: DeadlineResult,
  sections: EmitLetter["letter_sections"],
  today: Date = new Date(),
): LetterArtifact {
  // The grounded legal basis: each validated sentence, placed verbatim.
  const law = claims.map((cl) => cl.rendered_sentence).join(" ");

  // Authoritative figures — straight from the quantum engine.
  const requireLines: string[] = [];
  if (quantum.deposit_return > 0) {
    requireLines.push(`- Return of my deposit of ${gbp(quantum.deposit_return)}.`);
  }
  requireLines.push(
    `- Payment of the statutory penalty: a sum of between ${gbp(quantum.penalty_min)} and ${gbp(
      quantum.penalty_max,
    )} (one to three times the deposit), the exact amount being at the court's discretion.`,
  );
  requireLines.push("- Payment within 14 days of any order the court may make.");

  const body = [
    `**${c.tenant_name}**`,
    c.tenant_address,
    "",
    todayHuman(today),
    "",
    `**To:** ${c.landlord_name}`,
    c.landlord_address,
    "",
    `Dear ${c.landlord_name},`,
    "",
    "## Letter Before Claim — return of tenancy deposit and statutory penalty",
    `**Property:** ${c.property_address}`,
    "",
    sections.intro,
    "",
    "### The facts",
    sections.facts,
    "",
    "### The breach",
    sections.breach,
    "",
    "### The law",
    law,
    "",
    "### What I require",
    sections.claim,
    "",
    requireLines.join("\n"),
    "",
    "### Resolving this without court",
    sections.adr,
    "",
    "### Next steps",
    sections.next_steps,
    "",
    `**Please respond by ${humanDate(deadline.lbc_response_deadline)} (within 14 days of the date of this letter).**`,
    "",
    "Yours faithfully,",
    "",
    c.tenant_name,
    "",
    "---",
    "**Enclosures:**",
    ...ENCLOSURES.map((e) => `- ${e}`),
  ].join("\n");

  return {
    body_markdown: body,
    provenance_map: claims,
    enclosures: ENCLOSURES,
    deadline,
  };
}
