/**
 * The Tools Arsenal: the full catalogue of tools the tenant can use, organised
 * by decision-tree branch. Each builder takes the case + computed key dates and
 * returns concrete {@link Tool}s — every one carrying a next action and a real
 * deadline date.
 */

import type { Tool } from "../../core/types.ts";
import type { CaseBranch, TenantCase } from "./case.ts";
import type { KeyDates } from "./keyDates.ts";
import { formatUK } from "../../core/dates.ts";

type ToolBuilder = (c: TenantCase, k: KeyDates) => Tool[];

const money = (n: number) => `£${n.toFixed(2)}`;

/* ------------------------------------------------------------------ *
 * Branch A — NOT_PROTECTED_COURT
 * Deposit was never protected (or non-compliant). Build the evidence
 * trail, demand return + penalty, then claim under s214.
 * ------------------------------------------------------------------ */
const notProtectedCourt: ToolBuilder = (c, k) => {
  const schemes = (c.protection.schemeSearches ?? [])
    .map((s) => s.scheme)
    .join(", ") || "DPS, mydeposits, TDS";
  const penaltyLow = c.deposit.amount;
  const penaltyHigh = c.deposit.amount * 3;

  return [
    {
      id: "verify-protection-online",
      title: "Verify protection status on all three schemes",
      category: "verify",
      priority: 1,
      legalBasis: "Housing Act 2004 s213 (duty to protect)",
      deadline: k.chaseBy,
      deadlineBasis: "Do first — evidence underpins every later step (evaluation + 3 days).",
      nextAction:
        `Run the official "is my deposit protected?" search on ${schemes} using ` +
        `surname "${c.tenant.name.split(" ").slice(-1)[0]}", postcode ${c.property.postcode}, ` +
        `deposit ${money(c.deposit.amount)} and date paid ${formatUK(k.depositPaidDate)}. ` +
        `Screenshot each "no record found" result and save it.`,
    },
    {
      id: "gather-evidence",
      title: "Assemble the evidence bundle",
      category: "evidence",
      priority: 2,
      legalBasis: "Housing Act 2004 ss213–214",
      deadline: k.letterBeforeActionSendBy,
      deadlineBasis: "Needed before sending the Letter Before Action.",
      nextAction:
        "Collect: (1) the signed tenancy agreement; (2) the bank statement line showing the " +
        `${money(c.deposit.amount)} payment to the landlord on ${formatUK(k.depositPaidDate)}; ` +
        "(3) the blank scheme/dispute fields in the Schedule 1 prescribed information; " +
        "(4) the three negative scheme-search screenshots.",
    },
    {
      id: "letter-before-action",
      title: "Send a Letter Before Action",
      category: "letter",
      priority: 3,
      legalBasis: "Pre-Action Protocol for Debt/Housing claims; Housing Act 2004 s214",
      deadline: k.letterBeforeActionSendBy,
      deadlineBasis: "Send within 7 days of evaluation to keep momentum.",
      nextAction:
        `Send the landlord (${c.landlord.email ?? "by post and email"}) a Letter Before Action ` +
        `demanding return of the ${money(c.deposit.amount)} deposit and stating your intention to ` +
        `claim the statutory penalty of ${money(penaltyLow)}–${money(penaltyHigh)} ` +
        `(1–3× the deposit) under s214 Housing Act 2004. Give 14 days to respond ` +
        `(by ${formatUK(k.letterBeforeActionResponseDeadline)}).`,
      documentTemplate: letterBeforeActionTemplate(c, k),
    },
    {
      id: "county-court-claim-s214",
      title: "Issue a County Court claim under s214",
      category: "court",
      priority: 4,
      legalBasis: "Housing Act 2004 s214 (deposit + 1–3× penalty)",
      deadline: k.claimLimitationLongstop,
      deadlineBasis:
        "Bring the claim after the LBA window expires and well before the 6-year limitation longstop.",
      nextAction:
        "If the landlord does not return the deposit by " +
        `${formatUK(k.letterBeforeActionResponseDeadline)}, issue a County Court claim ` +
        `(money claim) for return of the ${money(c.deposit.amount)} deposit plus a penalty of ` +
        `${money(penaltyLow)}–${money(penaltyHigh)} under s214 Housing Act 2004. ` +
        "Attach the evidence bundle.",
    },
  ];
};

/* ------------------------------------------------------------------ *
 * Branch B — AGREES_IN_FULL
 * Landlord agreed; make sure the money actually lands within 10 days.
 * ------------------------------------------------------------------ */
const agreesInFull: ToolBuilder = (c, k) => {
  const returnBy = k.contractualReturnDeadline ?? k.escalateBy;
  return [
    {
      id: "confirm-payment-details",
      title: "Send payment + forwarding details in writing",
      category: "negotiation",
      priority: 1,
      legalBasis: "Tenancy agreement clause 4.1(d)",
      deadline: k.chaseBy,
      deadlineBasis: "Send promptly so the landlord can pay within the 10-working-day window.",
      nextAction:
        "Reply in writing confirming your bank account details and forwarding address, and " +
        `the agreed full return of ${money(c.deposit.amount)}. Ask for confirmation of the ` +
        "transfer date.",
    },
    {
      id: "chase-return-deadline",
      title: "Chase if the deposit is not received in time",
      category: "chase",
      priority: 2,
      legalBasis: "Tenancy agreement clause 4.1(d) — 10 working days after tenancy end",
      deadline: returnBy,
      deadlineBasis: `10 working days after end of tenancy (${formatUK(returnBy)}).`,
      nextAction:
        `If ${money(c.deposit.amount)} has not arrived by ${formatUK(returnBy)}, send a written ` +
        "chase noting the contractual return deadline has passed and requesting immediate payment.",
    },
  ];
};

/* ------------------------------------------------------------------ *
 * Branch C — DISPUTES_DEDUCTIONS
 * Deposit is protected; use the scheme's free dispute resolution (ADR).
 * ------------------------------------------------------------------ */
const disputesDeductions: ToolBuilder = (c, k) => {
  const scheme = c.protection.scheme ?? "the protecting scheme";
  return [
    {
      id: "request-itemised-deductions",
      title: "Request an itemised breakdown of deductions",
      category: "negotiation",
      priority: 1,
      legalBasis: "Tenancy agreement clause 4.1(e)",
      deadline: k.chaseBy,
      deadlineBasis: "Ask early so you can evaluate the claim before the ADR window.",
      nextAction:
        "Write to the landlord requesting a written, itemised breakdown of every proposed " +
        "deduction with supporting evidence (invoices, quotes, check-in/check-out inventory).",
    },
    {
      id: "compile-dispute-evidence",
      title: "Compile counter-evidence",
      category: "evidence",
      priority: 2,
      legalBasis: "Scheme ADR evidential requirements",
      deadline: k.letterBeforeActionSendBy,
      deadlineBasis: "Gather before opening the ADR case.",
      nextAction:
        "Assemble check-in/check-out inventories, dated photos, receipts and correspondence " +
        "showing the property's condition and that deductions exceed fair wear and tear.",
    },
    {
      id: "raise-scheme-adr",
      title: `Raise a free dispute (ADR) with ${scheme}`,
      category: "adr",
      priority: 3,
      legalBasis: "Tenancy agreement clause 4.1(f); scheme dispute-resolution rules",
      deadline: k.adrRaiseBy,
      deadlineBasis: `Raise promptly — within ~3 months of tenancy end (${formatUK(k.adrRaiseBy)}).`,
      nextAction:
        `Open a free dispute through ${scheme}'s alternative dispute resolution (ADR) service. ` +
        `The disputed amount is held by the scheme while an adjudicator decides; submit your ` +
        "evidence bundle.",
    },
  ];
};

/* ------------------------------------------------------------------ *
 * Branch D — LANDLORD_SILENT
 * Protected, but no response. Chase, then escalate to demand / ADR / court.
 * ------------------------------------------------------------------ */
const landlordSilent: ToolBuilder = (c, k) => {
  const scheme = c.protection.scheme ?? "the protecting scheme";
  return [
    {
      id: "chase-polite-reminder",
      title: "Send a polite chase",
      category: "chase",
      priority: 1,
      deadline: k.chaseBy,
      deadlineBasis: `Chase within 3 days of evaluation (${formatUK(k.chaseBy)}).`,
      nextAction:
        `Send a short written reminder requesting return of the ${money(c.deposit.amount)} ` +
        "deposit, restating your forwarding address and a clear payment deadline.",
    },
    {
      id: "formal-written-demand",
      title: "Send a formal written demand / Letter Before Action",
      category: "letter",
      priority: 2,
      legalBasis: "Pre-Action Protocol",
      deadline: k.escalateBy,
      deadlineBasis: `If still silent, escalate by ${formatUK(k.escalateBy)}.`,
      nextAction:
        "If there is no response to the chase, send a formal Letter Before Action giving 14 days " +
        "to return the deposit and stating you will escalate to the scheme's ADR and/or court.",
      documentTemplate: letterBeforeActionTemplate(c, k),
    },
    {
      id: "escalate-adr-or-court",
      title: `Escalate to ${scheme} ADR or court`,
      category: "adr",
      priority: 3,
      legalBasis: "Scheme dispute-resolution rules; County Court money claim",
      deadline: k.adrRaiseBy,
      deadlineBasis: `Escalate promptly (${formatUK(k.adrRaiseBy)}).`,
      nextAction:
        `If the deadline passes with no return, open a single-claim / ADR case with ${scheme} ` +
        "(for protected deposits) or issue a County Court money claim for the deposit.",
    },
  ];
};

const BUILDERS: Record<CaseBranch, ToolBuilder> = {
  NOT_PROTECTED_COURT: notProtectedCourt,
  AGREES_IN_FULL: agreesInFull,
  DISPUTES_DEDUCTIONS: disputesDeductions,
  LANDLORD_SILENT: landlordSilent,
};

/** Returns the matched, priority-ordered toolset for a branch. */
export function buildToolsForBranch(
  branch: CaseBranch,
  c: TenantCase,
  k: KeyDates,
): Tool[] {
  return BUILDERS[branch](c, k).sort((a, b) => a.priority - b.priority);
}

/**
 * Calibrated demand letter (Never Split the Difference style). It is an
 * information-gathering instrument, not boilerplate: a label to name the
 * situation, a disarming line, calibrated "How/What" questions the landlord
 * must answer to engage, a concrete deadline, and a compliant statement of
 * consequences. The job of this letter is to GET A RESPONSE — that response is
 * the information the next round depends on.
 */
function letterBeforeActionTemplate(c: TenantCase, k: KeyDates): string {
  const deadline = formatUK(k.letterBeforeActionResponseDeadline);
  const amount = money(c.deposit.amount);
  const unprotected = !c.protection.protectedInScheme;

  const lines = [
    `Dear ${c.landlord.name},`,
    ``,
    `Re: Return of tenancy deposit — ${c.property.address}`,
    ``,
    `I'm writing about the ${amount} deposit I paid on ${formatUK(k.depositPaidDate)} for the ` +
      `above property.`,
    ``,
  ];

  if (unprotected) {
    // Label + the leverage (no scheme record).
    lines.push(
      `It looks like the deposit may never have been protected in a government-authorised ` +
        `scheme, and that I was not given the prescribed information. I've checked the DPS, ` +
        `mydeposits and TDS registers and can find no record of it.`,
    );
  } else {
    lines.push(
      `The tenancy has ended and I've asked for the deposit back, but I haven't had a clear ` +
        `response.`,
    );
  }

  lines.push(
    ``,
    // Disarming / accusation audit.
    `I'd genuinely like to resolve this directly, without either of us going to court.`,
    ``,
    // Calibrated questions — these require a reply (= information).
    `To help me understand where things stand:`,
    unprotected
      ? `  • How am I supposed to confirm my deposit was protected when none of the three schemes hold a record of it?`
      : `  • How am I supposed to plan around this while the return is outstanding?`,
    `  • What can we do to put this right between us?`,
    ``,
    `To settle this now, please return the full ${amount} to me by ${deadline}.`,
    ``,
    `If I don't hear from you, I'll have little choice but to refer the matter to the County ` +
      `Court, where a tenant may be awarded the deposit plus a penalty of one to three times ` +
      `its value under section 214 of the Housing Act 2004. I would much rather settle it ` +
      `directly with you.`,
    ``,
    `Please reply by ${deadline} so we can sort this out.`,
    ``,
    `Yours sincerely,`,
    c.tenant.name,
  );

  return lines.join("\n");
}
