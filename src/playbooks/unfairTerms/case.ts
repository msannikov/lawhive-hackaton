/**
 * Unfair-terms domain types (UK consumer contracts). Facts needed to assess
 * whether a gym-membership term (lock-in / auto-renewal / cancellation charge)
 * is unfair under the Consumer Rights Act 2015 Part 2, and to dispute the debt
 * a collector is now chasing.
 *
 * Generic types (Tool, CaseAssessment, …) live in ../../core/types.ts.
 */

import type { ISODate } from "../../core/types.ts";

export interface Party {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

/** Which kind of term the consumer is challenging. */
export type ChallengedTermType =
  | "minimum_term" // long lock-in / minimum term
  | "auto_renewal" // contract auto-renews and is hard to exit
  | "cancellation_charge" // disproportionate charge to leave
  | "other";

/** Why the consumer says they should be able to exit (CMA gym guidance). */
export type CancellationReason =
  | "job_loss"
  | "relocation"
  | "injury_or_illness"
  | "financial_hardship"
  | "other"
  | "unknown";

export interface MembershipInfo {
  /** When the membership started. */
  startDate: ISODate;
  /** Minimum / lock-in term in months (e.g. 12). */
  minimumTermMonths: number;
  /** Recurring fee. */
  monthlyFee: number;
  currency: "GBP";
  /** True if the contract auto-renews at the end of the minimum term. */
  autoRenews: boolean;
}

/** The specific term under challenge and how prominent it was. */
export interface ChallengedTerm {
  type: ChallengedTermType;
  /** Verbatim or paraphrased text of the term being challenged. */
  description: string;
  /**
   * Was the term transparent and prominent (CRA s64/s68)? A core price/subject
   * term escapes the fairness test only if it is transparent AND prominent.
   */
  transparent: boolean;
  prominent: boolean;
}

/** How the gym responded when the consumer tried to cancel. */
export type GymResponse =
  | "refused" // refused to cancel / insisted on the term
  | "offered_reduction" // offered a reduced settlement
  | "agreed_to_waive" // agreed to release the consumer
  | "silent" // never responded
  | "unknown";

/** The debt now being chased by a collector. */
export interface DebtClaim {
  /** Amount the collector says is owed. */
  amount: number;
  currency: "GBP";
  /** Name of the debt-collection agency. */
  collectorName: string;
  /** Date of the most recent collection letter, if known. */
  letterDate?: ISODate;
  /** Has the consumer already disputed the debt in writing? */
  disputed?: boolean;
  /**
   * True if the collection conduct looks aggressive/misleading (FCA CONC):
   * threats, pressure, repeated contact, misrepresenting status, etc.
   */
  aggressive?: boolean;
}

export interface UnfairTermsCase {
  consumer: Party;
  /** The gym / business that is the other contracting party. */
  business: Party;
  membership: MembershipInfo;
  challengedTerm: ChallengedTerm;
  /** Why the consumer wanted to cancel. */
  cancellationReason: CancellationReason;
  /** When the consumer first tried to cancel, if known. */
  cancellationAttemptDate?: ISODate;
  gymResponse: GymResponse;
  debt: DebtClaim;
  evaluationDate?: ISODate;
  /**
   * Where the user is in the negotiation. Declared by the orchestrator each
   * round (no internal state machine): "initial" before any dispute letter,
   * "post_dispute" after the written dispute was sent, "post_complaint" after a
   * formal complaint / ADR. Drives escalation.
   */
  negotiationStage?: "initial" | "post_dispute" | "post_complaint";
}

/** The three terminal outcomes of the unfair-terms decision tree. */
export type UnfairTermsBranch =
  | "UNFAIR_TERM_LIKELY" // term looks unfair / not transparent → non-binding
  | "AGGRESSIVE_COLLECTION" // collection conduct breaches CONC → dispute + complain
  | "ARGUABLE"; // term may be enforceable → negotiate a reduced settlement
