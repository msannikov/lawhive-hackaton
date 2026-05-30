/**
 * Unfair-dismissal + discrimination domain types (England & Wales). A RICHER
 * sibling of the employment-termination stub: it carries the facts a redundancy-
 * as-pretext / sex-discrimination case turns on — qualifying service, the
 * protected characteristic, the grievance + appeal trail, the ACAS Early
 * Conciliation "stop the clock" dates, the settlement offer, and pay (for loss
 * calculations).
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

/** Reason the employer gave for the dismissal. */
export type DismissalReason =
  | "redundancy"
  | "conduct"
  | "capability"
  | "some_other_substantial_reason"
  | "other";

/**
 * Protected characteristic relied on for an Equality Act 2010 claim. This case
 * family is built around `sex`, but the union keeps the door open.
 */
export type DiscriminationGround =
  | "sex"
  | "pregnancy_maternity"
  | "race"
  | "disability"
  | "age"
  | "religion_belief"
  | "sexual_orientation"
  | "gender_reassignment"
  | "marriage_civil_partnership"
  | "other";

export interface EmploymentInfo {
  /** Start of continuous service. */
  startDate: ISODate;
  /**
   * Effective date of termination (EDT) — the day employment actually ends.
   * The ET1 time limit runs from here (or from the discriminatory act).
   */
  endDate?: ISODate;
  jobTitle?: string;
}

export interface DismissalInfo {
  reason: DismissalReason;
  /** The reason text as written in the dismissal/redundancy letter. */
  reasonGiven?: string;
  /** Date the dismissal was notified (the redundancy/dismissal letter date). */
  noticeDate?: ISODate;
}

export interface DiscriminationInfo {
  /** Whether the documents allege a discrimination/Equality Act claim at all. */
  alleged: boolean;
  ground?: DiscriminationGround;
  /** Short summary of the facts said to evidence discrimination/victimisation. */
  facts?: string;
  /**
   * A "protected act" was done (e.g. a grievance expressly alleging
   * discrimination) and the dismissal looks like a detriment for it →
   * victimisation under s27 Equality Act 2010.
   */
  protectedActDone?: boolean;
}

/** An internal step (grievance or appeal) and how it was decided. */
export interface InternalProcess {
  raised: boolean;
  raisedDate?: ISODate;
  outcomeDate?: ISODate;
  /** "upheld" | "not_upheld" | "pending" | "unknown". */
  outcome?: ProcessOutcome;
}

export type ProcessOutcome = "upheld" | "not_upheld" | "pending" | "unknown";

/**
 * ACAS Early Conciliation — mandatory before an Employment Tribunal claim.
 * Day A = date ACAS received the EC notification; Day B = date the certificate
 * was issued. These drive the statutory "stop the clock" extension of the ET1
 * time limit (s207B Employment Rights Act 1996).
 */
export interface AcasEarlyConciliation {
  /** Whether EC has been started / a certificate obtained. */
  completed: boolean;
  /** Day A — ACAS received the EC notification. */
  notificationDate?: ISODate;
  /** Day B — the EC certificate was issued. */
  certificateDate?: ISODate;
  certificateNumber?: string;
}

export interface SettlementOffer {
  offered: boolean;
  amount?: number;
  currency?: "GBP";
  /** Date the offer was made. */
  offerDate?: ISODate;
  /** Deadline by which the offer must be accepted, if stated. */
  acceptByDate?: ISODate;
  /**
   * "cot3"          — concluded through ACAS (no independent-advice requirement);
   * "settlement_agreement" — s203 ERA 1996 agreement (independent advice REQUIRED);
   * "unknown".
   */
  vehicle?: SettlementVehicle;
}

export type SettlementVehicle = "cot3" | "settlement_agreement" | "unknown";

export interface PayInfo {
  /** Gross basic salary per annum, if stated. */
  annualGross?: number;
  /** Gross basic pay per month, if stated. */
  monthlyGross?: number;
  /** Net pay per month, if stated. */
  monthlyNet?: number;
  currency?: "GBP";
}

export interface UnfairDismissalCase {
  employee: Party;
  employer: Party;
  employment: EmploymentInfo;
  dismissal: DismissalInfo;
  discrimination: DiscriminationInfo;
  grievance: InternalProcess;
  appeal: InternalProcess;
  acas: AcasEarlyConciliation;
  settlement: SettlementOffer;
  pay: PayInfo;
  evaluationDate?: ISODate;
  /**
   * Where the user is in the process. Declared by the orchestrator each round
   * (no internal state machine): "initial" before lodging anything,
   * "post_acas" once an EC certificate is in hand (offer live, decision due),
   * "post_et1" once the ET1 has been presented. Drives escalation.
   */
  negotiationStage?: "initial" | "post_acas" | "post_et1";
}

/** The terminal outcomes of the unfair-dismissal / discrimination decision tree. */
export type UnfairDismissalBranch =
  | "DISCRIMINATION_CLAIM"
  | "UNFAIR_DISMISSAL"
  | "SETTLEMENT_DECISION"
  | "REVIEW_NEEDED";
