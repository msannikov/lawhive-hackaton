/**
 * Unpaid-wages domain types. The vertical is UK employment — unauthorised
 * deduction from wages under s13 Employment Rights Act 1996, where "wages"
 * includes contractual commission/bonus that has become payable.
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

/** A single sum the employee says is owed and has not been paid. */
export interface UnpaidItem {
  /** e.g. "March 2026 salary", "Q4 commission", "accrued holiday pay". */
  label: string;
  amount: number;
  currency: "GBP";
  /** "wages" (salary/commission/holiday) vs "other" — only wages engage s13 ERA. */
  kind: "salary" | "commission" | "holiday" | "other";
}

export interface CommissionInfo {
  /** Is contractual commission/bonus part of the unpaid sum? */
  claimed: boolean;
  amount?: number;
  /** How the entitlement was confirmed (e.g. a written email from a manager). */
  confirmedInWriting?: boolean;
  /** Who confirmed it and when, if stated (e.g. "Tobias Rhodes, 17 March 2026"). */
  confirmedBy?: string;
  confirmedDate?: ISODate;
}

/**
 * How the employer has responded to the demand for payment.
 *  - pays_in_full     : agreed to pay everything owed
 *  - disputes         : disputes the entitlement (typically the commission)
 *  - silent           : no substantive response / stalling
 *  - engaging         : actively negotiating a figure or timeline
 */
export type EmployerResponse =
  | "pays_in_full"
  | "disputes"
  | "silent"
  | "engaging"
  | "unknown";

export interface UnpaidWagesCase {
  employee: Party;
  employer: Party;
  role: string;
  /** Basic pay, if stated (annual gross), and the contractual pay date. */
  basicSalaryAnnual?: number;
  /** Day of month / description the wages were due (informational). */
  payDateDescription?: string;
  /** Itemised list of everything unpaid. */
  unpaidItems: UnpaidItem[];
  /** Total unpaid sum (gross), summed from items if not given directly. */
  amountUnpaid: number;
  currency: "GBP";
  commission: CommissionInfo;
  /**
   * The date of the deduction — the pay date the money was due but not paid. If
   * a series of deductions, this is the LAST one. This anchors the ET limit.
   */
  deductionDate: ISODate;
  /** Did the employee raise the underpayment with HR/employer in writing? */
  hrContacted: boolean;
  /** Date of the first written approach to HR/employer, if known. */
  hrFirstContactDate?: ISODate;
  /** Did the employer reply at all (even just an acknowledgement)? */
  hrResponded: boolean;
  employerResponse: EmployerResponse;
  /** Has a formal written grievance been raised under the ACAS Code? */
  grievanceRaised?: boolean;
  evaluationDate?: ISODate;
  /**
   * Where the user is in the process. Declared by the orchestrator each round
   * (no internal state machine): "initial" before any formal grievance,
   * "post_grievance" after a written grievance was raised, "post_acas" after
   * ACAS Early Conciliation has started/ended. Drives escalation.
   */
  negotiationStage?: "initial" | "post_grievance" | "post_acas";
}

/** The three terminal outcomes of the unpaid-wages decision tree. */
export type UnpaidWagesBranch =
  | "UNLAWFUL_DEDUCTION"
  | "DISPUTED_COMMISSION"
  | "EMPLOYER_ENGAGING";
