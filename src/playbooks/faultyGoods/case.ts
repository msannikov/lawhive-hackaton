/**
 * Faulty-goods domain types (UK Consumer Rights Act 2015). The running example
 * is a faulty used car bought from a dealer, but the shape fits any GOODS bought
 * from a trader. Generic types (Tool, CaseAssessment, …) live in
 * ../../core/types.ts.
 *
 * Legal anchor: the CRA 2015 implied terms — goods must be of satisfactory
 * quality (s9), fit for purpose (s10) and as described (s11) — plus the tiered
 * remedies: short-term right to reject within 30 days (s20/s22), repair or
 * replacement (s23), and price reduction / final right to reject (s24). These
 * rights only bite because the seller is a TRADER, not a private seller.
 */

import type { ISODate } from "../../core/types.ts";

export interface Party {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

/** The goods bought — here a used vehicle, but generalised. */
export interface GoodsInfo {
  description: string;
  /** Vehicle registration / VIN / serial, when the goods are identifiable. */
  identifier?: string;
  /** Odometer reading at purchase, for vehicles. */
  mileageAtPurchase?: number;
}

export interface PurchaseInfo {
  amount: number;
  currency: "GBP";
  /** Date ownership transferred / goods delivered — starts the 30-day clock. */
  purchaseDate: ISODate;
}

export interface FaultInfo {
  description: string;
  /** Independent diagnosis (e.g. the mechanic's report finding), if any. */
  diagnosticFinding?: string;
  /** Date the fault first appeared / was noticed. */
  dateAppeared?: ISODate;
}

/** Whether the seller is a trader/business (CRA applies) or a private seller. */
export type SellerType = "trader" | "private" | "unknown";

/**
 * How the trader has responded to the complaint so far. Drives the decision
 * tree's second node and the remedy that is still open to the buyer.
 */
export type DealerResponse =
  | "agrees_refund"
  | "offers_repair"
  | "repair_failed"
  | "refuses"
  | "silent"
  | "unknown";

export interface FaultyGoodsCase {
  buyer: Party;
  seller: Party;
  sellerType: SellerType;
  goods: GoodsInfo;
  purchase: PurchaseInfo;
  fault: FaultInfo;
  dealerResponse: DealerResponse;
  /** True iff the trader has already attempted one repair that did not fix it. */
  repairAttempted?: boolean;
  evaluationDate?: ISODate;
  /**
   * Where the user is in the negotiation. Declared by the orchestrator each
   * round (no internal state machine): "initial" before any written rejection,
   * "post_letter" after the rejection / repair demand was sent, "post_lbc"
   * after the Letter Before Claim, "post_adr" after Motor Ombudsman ADR. Drives
   * escalation.
   */
  negotiationStage?: "initial" | "post_letter" | "post_lbc" | "post_adr";
}

/** The four terminal outcomes of the faulty-goods decision tree. */
export type FaultyGoodsBranch =
  | "WITHIN_30_DAYS"
  | "REPAIR_OR_REPLACE"
  | "FINAL_RIGHT_TO_REJECT"
  | "DEALER_REFUSES";
