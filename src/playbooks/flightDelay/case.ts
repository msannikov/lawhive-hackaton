/**
 * Flight-delay domain types (UK Regulation (EC) 261/2004, retained "UK261").
 * Generic types (Tool, CaseAssessment, …) live in ../../core/types.ts; these are
 * local to this playbook.
 */

import type { ISODate } from "../../core/types.ts";

export interface Passenger {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

/**
 * The three UK261 distance bands. The great-circle distance of the *whole
 * journey* fixes the compensation: £220 / £350 / £520.
 */
export type DistanceBand = "le1500" | "1500to3500" | "gt3500";

/** What triggered the UK261 right (each has its own qualifying test). */
export type DisruptionType =
  | "delay"
  | "cancellation"
  | "denied_boarding"
  | "unknown";

export interface FlightInfo {
  /** The operating carrier — the airline that actually flew (or should have). */
  airline: string;
  flightNumber: string;
  /** Scheduled date of the flight (local), in YYYY-MM-DD. */
  date: ISODate;
  origin: string;
  destination: string;
  /** Great-circle distance of the journey in km, if stated by the documents. */
  distanceKm?: number;
  /** Distance band — derived from distanceKm when the documents give a figure. */
  distanceBand: DistanceBand;
  /** UK departure or a UK/EU carrier arriving in the UK → UK261 applies. */
  ukOrEuRoute: boolean;
}

/** Scheduled vs actual timings. Times are HH:MM (24h) strings when known. */
export interface Timings {
  scheduledDeparture?: string;
  actualDeparture?: string;
  scheduledArrival?: string;
  actualArrival?: string;
  /** Delay measured AT THE DESTINATION, in whole hours (the figure UK261 uses). */
  arrivalDelayHours?: number;
}

/**
 * The airline's stated reason and whether it amounts to an
 * extraordinary-circumstances defence. Technical faults generally do NOT count;
 * severe weather, ATC/air-traffic restrictions and third-party strikes can.
 */
export interface DisruptionReason {
  reasonGiven?: string;
  /** True if the airline expressly relies on "extraordinary circumstances". */
  extraordinaryClaimed: boolean;
  /**
   * Best-effort categorisation of the stated reason. "technical" is usually
   * within the carrier's control (claim still strong); weather/ATC/strike can be
   * genuinely extraordinary.
   */
  reasonCategory?: "weather" | "atc" | "strike" | "technical" | "other";
}

/** Where the compensation claim has got to with the airline. */
export type ClaimStatus =
  | "not_submitted"
  | "submitted"
  | "acknowledged"
  | "rejected"
  | "unknown";

export interface FlightDelayCase {
  passenger: Passenger;
  flight: FlightInfo;
  timings: Timings;
  disruption: { type: DisruptionType } & DisruptionReason;
  /** For cancellations: days' notice given before the scheduled date, if known. */
  cancellationNoticeDays?: number;
  claimStatus: ClaimStatus;
  /** Date the passenger first submitted the written claim, if known. */
  claimSubmittedDate?: ISODate;
  evaluationDate?: ISODate;
  /**
   * Where the user is in the negotiation. Declared by the orchestrator each
   * round (no internal state machine): "initial" before any written claim,
   * "post_claim" after the airline was asked, "post_adr" after the ADR body /
   * CAA ruled. Drives escalation.
   */
  negotiationStage?: "initial" | "post_claim" | "post_adr";
}

/** The three terminal outcomes of the UK261 decision tree. */
export type FlightDelayBranch =
  | "ELIGIBLE"
  | "EXTRAORDINARY_CLAIMED"
  | "NOT_ELIGIBLE";
