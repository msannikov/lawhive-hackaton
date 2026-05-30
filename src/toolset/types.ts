/**
 * Domain types for the UK tenancy-deposit-return toolset.
 *
 * The model captures the facts an orchestrator can extract from a tenant's
 * documents (tenancy agreement, bank statement, scheme search results) and the
 * outputs the decision tree produces (a branch + a concrete toolset).
 */

/** Calendar date in `YYYY-MM-DD` form. */
export type ISODate = string;

export interface Party {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface DepositInfo {
  /** Amount in major currency units, e.g. 980.77. */
  amount: number;
  currency: "GBP";
  /** Date the landlord received the deposit (starts the 30-day protection clock). */
  paidDate: ISODate;
}

export interface TenancyInfo {
  startDate: ISODate;
  /** Fixed-term end, or the actual end date if the tenancy has terminated. */
  endDate?: ISODate;
  ended: boolean;
}

/** The three government-authorised tenancy deposit schemes for England & Wales. */
export type AuthorisedScheme = "DPS" | "mydeposits" | "TDS";

export interface SchemeSearchResult {
  scheme: AuthorisedScheme;
  /** Did the tenant actually run the "is my deposit protected?" search? */
  searched: boolean;
  /** Did the search return a matching protected record? */
  found: boolean;
  reference?: string;
}

export interface ProtectionInfo {
  /** True only if a deposit record was found in an authorised scheme. */
  protectedInScheme: boolean;
  scheme?: AuthorisedScheme | null;
  /** Date the deposit was registered with the scheme, if known. */
  dateProtected?: ISODate | null;
  /**
   * Whether the landlord served the prescribed information within 30 days
   * (Housing (Tenancy Deposits) (Prescribed Information) Order 2007).
   */
  prescribedInformationGiven: boolean;
  /** Optional record of the three official scheme searches. */
  schemeSearches?: SchemeSearchResult[];
}

/** How the landlord is responding to the request to return the deposit. */
export type LandlordResponse =
  | "agrees_in_full"
  | "disputes_deductions"
  | "silent"
  | "unknown";

/**
 * The full set of case facts the decision tree operates on. This is what an
 * orchestrator assembles before calling {@link evaluateCase}.
 */
export interface TenantCase {
  tenant: Party;
  landlord: Party;
  property: { address: string; postcode: string };
  deposit: DepositInfo;
  tenancy: TenancyInfo;
  protection: ProtectionInfo;
  landlordResponse: LandlordResponse;
  /** Date the tenant asked for the deposit back (root node event). Defaults to evaluationDate. */
  depositRequestDate?: ISODate;
  /** Whether the tenant has given the landlord a forwarding address. */
  forwardingAddressProvided?: boolean;
  /** "Today" for deadline computation. Defaults to the system date. */
  evaluationDate?: ISODate;
}

/** The four terminal outcomes of the decision tree (leaf nodes of the SVG). */
export type CaseBranch =
  | "NOT_PROTECTED_COURT"
  | "AGREES_IN_FULL"
  | "DISPUTES_DEDUCTIONS"
  | "LANDLORD_SILENT";

export type ToolCategory =
  | "verify"
  | "evidence"
  | "letter"
  | "negotiation"
  | "adr"
  | "court"
  | "chase";

/**
 * A single tool the tenant can act on. Per the brief, every tool carries:
 *  1. a concrete next action for the user, and
 *  2. a concrete deadline (a real date).
 */
export interface Tool {
  id: string;
  title: string;
  category: ToolCategory;
  /** (1) The concrete next action for the user. */
  nextAction: string;
  /** (2) The concrete date by which the user should act. */
  deadline: Date;
  /** Human-readable explanation of how the deadline was derived. */
  deadlineBasis: string;
  /** Statutory / contractual hook, where relevant. */
  legalBasis?: string;
  /** Lower number = do this sooner. */
  priority: number;
  /** Optional ready-to-send document body. */
  documentTemplate?: string;
}

/** The orchestrator-facing result of running the decision tree over a case. */
export interface CaseAssessment {
  branch: CaseBranch;
  branchLabel: string;
  summary: string;
  /** Step-by-step trace of how the branch was reached (for auditability). */
  reasoning: string[];
  /** Key computed dates, formatted for display. */
  keyDates: Record<string, string>;
  /** The matched toolset, ordered by priority. */
  tools: Tool[];
}
