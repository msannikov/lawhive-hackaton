/**
 * Hardcoded intake (spec §3.1 deferred). Each case is a fully-populated
 * DepositCase that drives one of the three terminal outcomes from the eval set
 * (§10): draft / escalate / refuse. In the real product these come from the
 * conversational state machine; here they are constants for the demo.
 */
import { DepositCaseSchema, type DepositCase } from "./models";

/** Case 01 — Jamie, Birmingham. Clean breach, ongoing tenancy → DRAFT LBC. */
const JAMIE: DepositCase = DepositCaseSchema.parse({
  deposit_amount: 980.0,
  date_deposit_paid: "2024-09-01",
  tenancy_type: "AST",
  country: "England",
  tenancy_start_date: "2024-09-01",
  protected_status: "no",
  prescribed_info_received: "no",
  tenancy_ended: false,
  tenancy_end_date: null,
  deposit_returned: false,
  amount_returned: 0.0,
  renewals_or_rollovers: "none",
  landlord_or_agent: "landlord",
  landlord_name: "Mr Robert Hayes",
  landlord_address: "8 Wake Green Road, Moseley, Birmingham, B13 9EZ",
  tenant_name: "Jamie Bennett",
  tenant_address: "42 Larches Street, Sparkbrook, Birmingham, B11 1AA",
  property_address: "42 Larches Street, Sparkbrook, Birmingham, B11 1AA",
});

/** Same facts as Jamie but with multiple roll-overs → ESCALATE (Superstrike, R9). */
const RENEWALS: DepositCase = DepositCaseSchema.parse({
  ...JAMIE,
  renewals_or_rollovers: "multiple",
  tenant_name: "Priya Sharma",
  tenant_address: "17 Mary Vale Road, Bournville, Birmingham, B30 2DJ",
  property_address: "17 Mary Vale Road, Bournville, Birmingham, B30 2DJ",
});

/** A lodger / licence arrangement → REFUSE (out of scope: not an AST). */
const LODGER: DepositCase = DepositCaseSchema.parse({
  deposit_amount: 600.0,
  date_deposit_paid: "2024-11-15",
  tenancy_type: "other",
  country: "England",
  tenancy_start_date: "2024-11-15",
  protected_status: "no",
  prescribed_info_received: "no",
  tenancy_ended: false,
  tenancy_end_date: null,
  deposit_returned: false,
  amount_returned: 0.0,
  renewals_or_rollovers: "none",
  landlord_or_agent: "landlord",
  landlord_name: "Ms Carol Whitfield",
  landlord_address: "3 Station Road, Kings Heath, Birmingham, B14 7SA",
  tenant_name: "Tom Reilly",
  tenant_address: "3 Station Road, Kings Heath, Birmingham, B14 7SA",
  property_address: "3 Station Road (lodger's room), Kings Heath, Birmingham, B14 7SA",
});

export interface CaseEntry {
  id: string;
  label: string;
  blurb: string;
  case: DepositCase;
}

export const CASES: Record<string, CaseEntry> = {
  jamie: {
    id: "jamie",
    label: "Jamie — clean breach",
    blurb: "£980 deposit, never protected, no prescribed information, tenancy ongoing.",
    case: JAMIE,
  },
  renewals: {
    id: "renewals",
    label: "Multiple renewals",
    blurb: "Same breach but the tenancy rolled over several times — fact-sensitive (Superstrike).",
    case: RENEWALS,
  },
  lodger: {
    id: "lodger",
    label: "Lodger / licence",
    blurb: "A resident-landlord lodging arrangement — not an assured shorthold tenancy.",
    case: LODGER,
  },
};

export function getCase(caseId: string): DepositCase | undefined {
  return CASES[caseId]?.case;
}

/** Lightweight list for the frontend case picker. */
export function listCases(): Array<{ id: string; label: string; blurb: string }> {
  return Object.values(CASES).map(({ id, label, blurb }) => ({ id, label, blurb }));
}
