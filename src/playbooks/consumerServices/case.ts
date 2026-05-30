/**
 * Consumer-services domain types. The vertical is a UK consumer contract for a
 * SERVICE (e.g. a wedding photographer / venue / supplier) that took a deposit
 * and further payments, then under-delivered or went silent.
 *
 * Generic types (Tool, CaseAssessment, …) live in ../../core/types.ts; these are
 * local to this playbook, mirroring depositReturn/case.ts.
 */

import type { ISODate } from "../../core/types.ts";

export interface Party {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface PaymentInfo {
  /** Total contract price agreed with the supplier. */
  totalPrice: number;
  /** Sum the consumer has actually paid (deposit + balance + extras). */
  amountPaid: number;
  currency: "GBP";
  /** Date the deposit was paid, if known (starts the paper trail). */
  depositPaidDate?: ISODate;
}

/**
 * What happened with performance. `delivery` is the high-level posture used by
 * the decision tree; the flags qualify it.
 */
export type DeliveryStatus =
  | "nothing_delivered" // total failure — supplier vanished / no service at all
  | "defective_or_late" // delivered but not with reasonable care/skill or late
  | "delivered_ok" // delivered acceptably (no live dispute)
  | "unknown";

/** How the supplier is responding to the consumer's contact. */
export type SupplierResponse =
  | "unresponsive" // messages ignored / supplier gone silent
  | "engaging" // replying and willing to discuss a resolution
  | "refusing" // replying but refusing to put it right or refund
  | "unknown";

export interface ServiceInfo {
  /** What was booked, e.g. "wedding photography". */
  serviceType: string;
  /** Date the booking / contract was made. */
  bookingDate?: ISODate;
  /** The date the service was due to be performed (e.g. the wedding day). */
  serviceDate?: ISODate;
  /** Plain-English note of what was vs was not delivered. */
  whatWasDelivered?: string;
}

export interface ConsumerServicesCase {
  consumer: Party;
  supplier: Party;
  service: ServiceInfo;
  payment: PaymentInfo;
  delivery: DeliveryStatus;
  supplierResponse: SupplierResponse;
  /** When the consumer first formally asked the supplier to put things right. */
  complaintDate?: ISODate;
  /** "Today" for all relative deadlines; defaults to now if absent. */
  evaluationDate?: ISODate;
  /**
   * Where the user is in the negotiation. Declared by the orchestrator each
   * round (no internal state machine): "initial" before any Letter Before Claim,
   * "post_letter" after it was sent, "post_adr" after ADR/negotiation attempts.
   * Drives escalation, exactly as in depositReturn.
   */
  negotiationStage?: "initial" | "post_letter" | "post_adr";
}

/** The three terminal outcomes of the consumer-services decision tree. */
export type Branch =
  | "TOTAL_NON_PERFORMANCE" // supplier vanished / nothing delivered → refund, LBC, small claim
  | "DEFECTIVE_OR_LATE" // delivered but poor/late → repeat performance or price reduction
  | "SUPPLIER_ENGAGING"; // supplier still talking → negotiate a resolution first
