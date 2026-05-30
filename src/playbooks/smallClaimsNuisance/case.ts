/**
 * Small-claims private-nuisance domain types.
 *
 * The vertical is a private-nuisance claim over encroaching tree roots causing
 * property damage (measure of loss = reasonable remedial cost), already IN
 * PROCEEDINGS on the small-claims track under the Civil Procedure Rules. The
 * facts that matter here are PROCEDURAL: which court directions deadline lapsed,
 * whether a judgment/order has been made, and the strict windows for relief from
 * sanctions, set-aside and appeal. Generic types (Tool, CaseAssessment, …) live
 * in ../../core/types.ts.
 */

import type { ISODate } from "../../core/types.ts";

export interface Party {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  /** Solicitors on the record for this party, if any (e.g. the Defendant's). */
  representative?: string;
}

/** The encroaching-roots nuisance and the loss claimed. */
export interface NuisanceInfo {
  /** Short description of the encroachment + damage. */
  description: string;
  /** Reasonable remedial cost claimed, in GBP (the builder's quote). */
  remedialCost: number;
  currency: "GBP";
  /** Who/what evidences the remedial cost (e.g. "Trentham Builders Ltd quote"). */
  remedialCostSource?: string;
}

/** A single dated obligation imposed by the court directions order. */
export interface DirectionsDeadline {
  /** What is due, e.g. "witness statements", "disclosure", "schedule of loss". */
  step: string;
  /** Date the step is due, YYYY-MM-DD. */
  date: ISODate;
}

export interface DirectionsOrder {
  /** Date the directions order was made, YYYY-MM-DD. */
  orderDate?: ISODate;
  /** The dated steps the order imposes. */
  deadlines: DirectionsDeadline[];
  /** Final-hearing date if listed, YYYY-MM-DD. */
  finalHearingDate?: ISODate;
}

/** Which directions step was missed and on what date it fell due. */
export interface MissedDeadlineInfo {
  /** The step that lapsed, e.g. "witness statement". */
  step: string;
  /** The date it was due (and missed), YYYY-MM-DD. */
  dueDate: ISODate;
  /** Whether the outstanding document has since been filed/served. */
  documentFiled?: boolean;
}

/** A judgment or order made against the party (default, in absence, or on merits). */
export interface JudgmentInfo {
  /** Date the judgment/order was made, YYYY-MM-DD (starts the appeal clock). */
  date: ISODate;
  /** How it came about. Drives whether set-aside (13.3 vs 39.3) is available. */
  basis: "default" | "non_attendance" | "on_merits" | "unknown";
  /** Outcome against the party, e.g. "claim dismissed". */
  outcome?: string;
  /** Whether permission to appeal was already refused below. */
  permissionToAppealRefused?: boolean;
}

/** Position on the single joint expert (CPR 35.7) — pivotal on causation. */
export type SjeStatus =
  | "proposed" // a single joint expert has been proposed/invited
  | "agreed" // the parties have agreed to a single joint expert
  | "obtained" // a report has been obtained
  | "declined" // no expert agreed/obtained
  | "not_applicable"
  | "unknown";

export interface SmallClaimsNuisanceCase {
  claimant: Party;
  defendant: Party;
  court: string;
  caseNumber: string;
  nuisance: NuisanceInfo;
  directions: DirectionsOrder;
  /** The lapsed directions deadline, if any. */
  missedDeadline?: MissedDeadlineInfo;
  /** A judgment/order made against the party, if any. */
  judgment?: JudgmentInfo;
  sje: SjeStatus;
  evaluationDate?: ISODate;
  /**
   * Where the user is in the procedural recovery. Declared by the orchestrator
   * each round (no internal state machine): "initial" before any application,
   * "post_application" after a relief/set-aside application was made, "post_ruling"
   * after the court has ruled on it. Drives escalation.
   */
  negotiationStage?: "initial" | "post_application" | "post_ruling";
}

/** The three terminal outcomes of the procedural-posture decision tree. */
export type SmallClaimsNuisanceBranch =
  | "JUDGMENT_ENTERED" // an order/judgment is in force → set-aside and/or appeal (21 days)
  | "MISSED_DIRECTIONS_DEADLINE" // a deadline lapsed, no final judgment → relief from sanctions (CPR 3.9)
  | "ON_TRACK"; // no breach → comply with the next directions deadline
