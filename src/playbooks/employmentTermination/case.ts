/**
 * Employment-termination domain types (stub). Minimal facts needed to check
 * basic UK rights after a dismissal/redundancy.
 */

import type { ISODate } from "../../core/types.ts";

export type TerminationType =
  | "dismissal"
  | "redundancy"
  | "resignation"
  | "other";

export interface EmploymentCase {
  employee: { name: string };
  employer: { name: string };
  employment: {
    startDate?: ISODate;
    /** Effective date of termination. */
    endDate?: ISODate;
    jobTitle?: string;
  };
  termination: {
    type: TerminationType;
    reasonGiven?: string;
    noticeGiven?: boolean;
  };
  evaluationDate?: ISODate;
}

export type EmploymentBranch =
  | "UNFAIR_DISMISSAL_POSSIBLE"
  | "LIMITED_QUALIFYING_RIGHTS"
  | "REVIEW_NEEDED";
