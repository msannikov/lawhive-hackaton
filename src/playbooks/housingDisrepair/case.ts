/**
 * Housing-disrepair domain types. Mirrors the deposit-return playbook's shape:
 * generic types (Tool, CaseAssessment, …) live in ../../core/types.ts; these are
 * local to this UK housing-disrepair vertical (persistent damp / mould in a
 * council or social tenancy).
 *
 * Legal spine: Landlord and Tenant Act 1985 s11 (repair the structure, exterior
 * and installations) and s9A / Homes (Fitness for Human Habitation) Act 2018
 * (the home must be fit for habitation, including freedom from serious damp and
 * mould). The tenant must NOTIFY the landlord and allow a reasonable time to
 * repair; remedies are an order for the works plus damages (loss of amenity and
 * any personal-injury / health element). Process: the Pre-Action Protocol for
 * Housing Conditions Claims (England) — Letter of Claim, 20 working days for the
 * landlord to respond and disclose records, then the County Court.
 */

import type { ISODate } from "../../core/types.ts";

export interface Party {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

/** How the disrepair was first brought to the landlord's attention. */
export type ReportMethod = "phone" | "email" | "letter" | "in_person" | "portal" | "unknown";

/** Whether the landlord is a local authority / housing association or private. */
export type LandlordType = "council" | "housing_association" | "private" | "unknown";

export interface TenancyInfo {
  /** When the tenancy began (anchors the 6-year contractual limitation period). */
  startDate: ISODate;
  /** Council / social / private — colours the available redress (e.g. Ombudsman). */
  landlordType: LandlordType;
}

/**
 * The disrepair itself. `firstReportedDate` starts the "reasonable time to
 * repair" clock; everything downstream (protocol letter, escalation) keys off
 * how long the defect has persisted since it was notified.
 */
export interface DisrepairInfo {
  /** Short description, e.g. "persistent black mould and damp". */
  description: string;
  /** Rooms affected, e.g. ["children's bedroom", "bathroom", "hallway"]. */
  roomsAffected: string[];
  /** When the tenant first notified the landlord (starts the repair clock). */
  firstReportedDate: ISODate;
  /** How it was reported. */
  reportMethod: ReportMethod;
  /** Whether the defect is still present at evaluation. */
  ongoing: boolean;
}

/**
 * What the landlord has done since being notified. `worksScheduled` /
 * `worksCompleted` distinguish a landlord who is acting from one who is not;
 * `recurredAfterWorks` captures token works that did not fix the problem.
 */
export interface LandlordActionInfo {
  /** Landlord acknowledged the report (an auto-acknowledgement counts). */
  acknowledged: boolean;
  /** Remedial works have been scheduled / a date given. */
  worksScheduled: boolean;
  /** Remedial works were carried out. */
  worksCompleted: boolean;
  /** The defect returned after works were done (token / ineffective repair). */
  recurredAfterWorks: boolean;
  /** Date the landlord last took a substantive step, if known. */
  lastActionDate?: ISODate;
}

/**
 * A council / Environmental Health (EHO) or surveyor inspection. A Category 1
 * HHSRS hazard finding is strong evidence the home is unfit for habitation.
 */
export interface InspectionInfo {
  inspected: boolean;
  inspectionDate?: ISODate;
  /** e.g. "condensation / inadequate ventilation" or "penetrating damp". */
  findingsSummary?: string;
  /** Inspector recorded an HHSRS Category 1 hazard (most serious). */
  hhsrsCategory1?: boolean;
}

/**
 * Health impact of the disrepair. A GP letter linking the conditions to a
 * resident's symptoms, plus any vulnerable occupant (child, elderly, disabled),
 * is what tips a case from "reported, not repaired" to "urgent health risk".
 */
export interface HealthImpactInfo {
  /** The tenant reports a health impact from the damp / mould. */
  healthImpactReported: boolean;
  /** A GP / medical letter evidences the impact. */
  gpLetterProvided: boolean;
  /** A child, elderly or disabled person lives at the property. */
  vulnerableOccupant: boolean;
  gpLetterDate?: ISODate;
  /** Short note, e.g. "child (5) persistent cough/wheeze, salbutamol inhaler". */
  summary?: string;
}

export interface HousingDisrepairCase {
  tenant: Party;
  landlord: Party;
  property: { address: string; postcode: string };
  tenancy: TenancyInfo;
  disrepair: DisrepairInfo;
  landlordAction: LandlordActionInfo;
  inspection: InspectionInfo;
  health: HealthImpactInfo;
  /** "Today" for all relative deadlines (caller context overrides). */
  evaluationDate?: ISODate;
  /**
   * Where the user is in the negotiation. Declared by the orchestrator each
   * round (no internal state machine): "initial" before any Letter of Claim,
   * "post_letter_of_claim" after it was sent, "post_protocol" once the 20-working
   * -day protocol response window has run. Drives escalation.
   */
  negotiationStage?: "initial" | "post_letter_of_claim" | "post_protocol";
}

/** The three terminal outcomes of the housing-disrepair decision tree. */
export type HousingDisrepairBranch =
  | "URGENT_HEALTH_RISK"
  | "REPORTED_NOT_REPAIRED"
  | "LANDLORD_ACTING";
