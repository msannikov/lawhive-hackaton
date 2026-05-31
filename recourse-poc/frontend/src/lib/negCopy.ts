/**
 * Per-domain wording for the shared negotiation UI. The panel, response logger
 * and uploader are reused across every playbook, so they look up the right
 * counterparty ("the landlord" / "the airline" / "your employer" …) and
 * resolution language by domain — with a safe generic fallback.
 */

export interface NegCopy {
  /** The other party, lower-case for mid-sentence use, e.g. "the landlord". */
  counterparty: string;
  /** Positive resolution button, e.g. "I got my deposit back". */
  resolvedLabel: string;
  /** Resolution status sentence fragment: "You marked {resolvedStatus} on …". */
  resolvedStatus: string;
  /** Example reply placeholder in the response logger. */
  replyPlaceholder: string;
  /** Label for the "they pushed back" response option. */
  disputeLabel: string;
  /** What documents to upload, for the accelerator. */
  uploadHint: string;
}

const DEFAULT: NegCopy = {
  counterparty: "the other side",
  resolvedLabel: "It's resolved",
  resolvedStatus: "the matter as resolved",
  replyPlaceholder: "Paste their reply here…",
  disputeLabel: "They've pushed back / disputed it",
  uploadHint: "your contract, payment proofs, letters and any evidence",
};

const MAP: Record<string, Partial<NegCopy>> = {
  deposit_return: {
    counterparty: "the landlord",
    resolvedLabel: "I got my deposit back",
    resolvedStatus: "your deposit as recovered",
    replyPlaceholder: "e.g. I'll return your deposit minus £150 for cleaning…",
    disputeLabel: "Wants to make deductions",
    uploadHint: "your tenancy agreement, a bank statement showing the deposit, and your deposit-scheme screenshots",
  },
  housing_disrepair: {
    counterparty: "the landlord",
    resolvedLabel: "It's been fixed",
    resolvedStatus: "the repairs as done",
    replyPlaceholder: "e.g. We'll send a contractor next week…",
    disputeLabel: "Disputes the disrepair",
    uploadHint: "your tenancy agreement, any inspection report, and your messages with the landlord",
  },
  faulty_goods: {
    counterparty: "the trader",
    resolvedLabel: "I got my refund or repair",
    resolvedStatus: "the matter as resolved",
    replyPlaceholder: "e.g. We'll look at it, but it's not our fault…",
    disputeLabel: "Refuses / blames you",
    uploadHint: "your purchase invoice, any fault report, and your messages with the seller",
  },
  consumer_services: {
    counterparty: "the supplier",
    resolvedLabel: "It's resolved",
    resolvedStatus: "the matter as resolved",
    replyPlaceholder: "e.g. We can reschedule but won't refund…",
    disputeLabel: "Refuses a refund",
    uploadHint: "your booking or contract, payment proofs, and your messages with the supplier",
  },
  unfair_terms: {
    counterparty: "the company",
    resolvedLabel: "It's been written off",
    resolvedStatus: "the matter as resolved",
    replyPlaceholder: "e.g. The contract is binding, you owe the balance…",
    disputeLabel: "Insists you owe it",
    uploadHint: "your membership or contract, the debt-collection letter, and your emails",
  },
  flight_delay: {
    counterparty: "the airline",
    resolvedLabel: "I got my compensation",
    resolvedStatus: "the claim as paid",
    replyPlaceholder: "e.g. The delay was due to extraordinary circumstances…",
    disputeLabel: "Rejected the claim",
    uploadHint: "your booking confirmation, boarding pass, and the airline's emails",
  },
  unpaid_wages: {
    counterparty: "your employer",
    resolvedLabel: "I've been paid",
    resolvedStatus: "the wages as paid",
    replyPlaceholder: "e.g. We dispute the commission is owed…",
    disputeLabel: "Disputes the amount",
    uploadHint: "your contract, payslips, and your emails to HR",
  },
  unfair_dismissal: {
    counterparty: "your employer",
    resolvedLabel: "It's settled",
    resolvedStatus: "the matter as settled",
    replyPlaceholder: "e.g. We're offering a settlement of…",
    disputeLabel: "Denies the claim",
    uploadHint: "your contract, the dismissal/redundancy letters, and your ACAS certificate",
  },
  building_dispute: {
    counterparty: "the contractor",
    resolvedLabel: "It's resolved",
    resolvedStatus: "the matter as resolved",
    replyPlaceholder: "e.g. We'll come back to finish, no refund…",
    disputeLabel: "Refuses to put it right",
    uploadHint: "your contract or quote, payment proofs, photos, and your messages with the contractor",
  },
  small_claims_nuisance: {
    counterparty: "the other party",
    resolvedLabel: "It's resolved",
    resolvedStatus: "the matter as resolved",
    replyPlaceholder: "e.g. The court order / their solicitor said…",
    disputeLabel: "Disputes liability",
    uploadHint: "the court papers, the directions order, quotes and your evidence",
  },
  employment_termination: {
    counterparty: "your employer",
    resolvedLabel: "It's resolved",
    resolvedStatus: "the matter as resolved",
    replyPlaceholder: "e.g. their reply about your redundancy…",
    disputeLabel: "Disputes the claim",
    uploadHint: "your contract, the dismissal letter, and your payslips",
  },
};

export function negCopy(domain: string): NegCopy {
  return { ...DEFAULT, ...(MAP[domain] ?? {}) };
}

/** Capitalise the first letter (for start-of-sentence use of a counterparty). */
export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
