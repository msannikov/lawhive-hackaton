/**
 * Deposit-return domain types. These used to live in toolset/types.ts; they are
 * now local to this playbook. Generic types (Tool, CaseAssessment, …) live in
 * ../../core/types.ts.
 */

import type { ISODate } from "../../core/types.ts";

export interface Party {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface DepositInfo {
  amount: number;
  currency: "GBP";
  /** Date the landlord received the deposit (starts the 30-day clock). */
  paidDate: ISODate;
}

export interface TenancyInfo {
  startDate: ISODate;
  endDate?: ISODate;
  ended: boolean;
}

export type AuthorisedScheme = "DPS" | "mydeposits" | "TDS";

export interface SchemeSearchResult {
  scheme: AuthorisedScheme;
  searched: boolean;
  found: boolean;
  reference?: string;
}

export interface ProtectionInfo {
  protectedInScheme: boolean;
  scheme?: AuthorisedScheme | null;
  dateProtected?: ISODate | null;
  prescribedInformationGiven: boolean;
  schemeSearches?: SchemeSearchResult[];
}

export type LandlordResponse =
  | "agrees_in_full"
  | "disputes_deductions"
  | "silent"
  | "unknown";

export interface TenantCase {
  tenant: Party;
  landlord: Party;
  property: { address: string; postcode: string };
  deposit: DepositInfo;
  tenancy: TenancyInfo;
  protection: ProtectionInfo;
  landlordResponse: LandlordResponse;
  depositRequestDate?: ISODate;
  forwardingAddressProvided?: boolean;
  evaluationDate?: ISODate;
}

/** The four terminal outcomes of the deposit decision tree. */
export type CaseBranch =
  | "NOT_PROTECTED_COURT"
  | "AGREES_IN_FULL"
  | "DISPUTES_DEDUCTIONS"
  | "LANDLORD_SILENT";
