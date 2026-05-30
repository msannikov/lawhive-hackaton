/**
 * Building-dispute domain types. A UK contract dispute over building /
 * home-improvement work that was abandoned, left incomplete or done defectively.
 * Generic types (Tool, CaseAssessment, …) live in ../../core/types.ts.
 */

import type { ISODate } from "../../core/types.ts";

export interface Party {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface ContractInfo {
  /** What the contractor agreed to do (e.g. "full kitchen renovation"). */
  scopeOfWorks: string;
  /** The agreed price in GBP, if a fixed price was agreed. */
  agreedPrice?: number;
  currency: "GBP";
  /** Date the contract/works were agreed, if known. */
  agreedDate?: ISODate;
}

/** A payment the customer made to the contractor (a bank transfer). */
export interface Payment {
  amount: number;
  /** YYYY-MM-DD the transfer was sent. */
  date: ISODate;
  reference?: string;
}

/**
 * The remedial / completion quote or invoice that evidences the loss: the
 * reasonable cost of completing or putting right the work. This is the measure
 * of damages.
 */
export interface RemedialCost {
  /** Who quoted/invoiced (the remedial contractor). */
  source: string;
  /** Total amount in GBP (inc VAT where shown). */
  amount: number;
  /** "quote" = priced completion estimate; "invoice" = work already done. */
  kind: "quote" | "invoice";
  date?: ISODate;
  reference?: string;
}

/**
 * How the original contractor has responded / behaved. `threatening` captures
 * abusive or intimidating conduct (which may engage the Protection from
 * Harassment Act 1997).
 */
export type ContractorResponse =
  | "abandoned"
  | "disputes_liability"
  | "threatening"
  | "negotiating"
  | "silent"
  | "unknown";

/**
 * Is the customer a consumer (Consumer Rights Act 2015 applies) or acting in the
 * course of a business (plain breach of contract)? Defaults to consumer.
 */
export type CustomerType = "consumer" | "business";

export interface BuildingDisputeCase {
  customer: Party;
  contractor: Party;
  property: { address: string; postcode: string };
  customerType: CustomerType;
  contract: ContractInfo;
  /** Every payment the customer made to the contractor. */
  payments: Payment[];
  /** Free-text description of what is incomplete or defective (from photos etc.). */
  defects: string;
  /** Remedial/completion quotes and invoices evidencing the loss. */
  remedialCosts: RemedialCost[];
  contractorResponse: ContractorResponse;
  /** True if any message from the contractor was abusive / intimidating. */
  threateningConduct?: boolean;
  /** Date the contractor abandoned the works / the breach crystallised. */
  breachDate?: ISODate;
  evaluationDate?: ISODate;
  /**
   * Where the user is in the negotiation. Declared by the orchestrator each
   * round (no internal state machine): "initial" before any letter,
   * "post_letter" after the Letter Before Claim was sent, "post_lbc" after the
   * response window closed. Drives escalation.
   */
  negotiationStage?: "initial" | "post_letter" | "post_lbc";
}

/** The three terminal outcomes of the building-dispute decision tree. */
export type BuildingDisputeBranch =
  | "INCOMPLETE_OR_DEFECTIVE"
  | "CONTRACTOR_THREATENING"
  | "NEGOTIATING";
