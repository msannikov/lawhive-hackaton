/**
 * Inbound adapter: the team engine's `TenantCase` (the funnel's normalised facts)
 * → Recourse's zod `DepositCase` (what the grounded-letter pipeline consumes).
 *
 * The two models are ~80% aligned. This bridges the gaps:
 *   - tri-state: TenantCase.protection.* are plain booleans, but DepositCase uses
 *     yes|no|unknown. "unsure" cannot survive a boolean, so the caller passes it
 *     explicitly via opts; when unknown, we record it in `unknown_slots` so the
 *     escalation router diverts to a human instead of emitting a confident breach
 *     letter (see escalation.ts / handoff.ts).
 *   - fields TenantCase lacks (country, tenancy_type, renewals) default to the
 *     in-scope demo case and are confirmable at intake.
 *
 * Ends with `DepositCaseSchema.parse` so a bad mapping fails loudly here, not in
 * the letter generator.
 */
import { DepositCaseSchema, type DepositCase } from "../models";
import type { TenantCase } from "../../../../src/playbooks/depositReturn/case.ts";

type TriState = "yes" | "no" | "unknown";

export interface AdapterOverrides {
  country?: "England" | "Wales" | "other";
  tenancy_type?: "AST" | "other";
  renewals_or_rollovers?: "none" | "one" | "multiple";
  landlord_or_agent?: "landlord" | "agent";
  /** Set when intake recorded "unsure" rather than a yes/no. */
  protected_status?: TriState;
  prescribed_info_received?: TriState;
  deposit_returned?: boolean;
  amount_returned?: number;
}

export function tenantCaseToDepositCase(
  tc: TenantCase,
  overrides: AdapterOverrides = {},
): DepositCase {
  const protected_status: TriState =
    overrides.protected_status ?? (tc.protection.protectedInScheme ? "yes" : "no");
  const prescribed_info_received: TriState =
    overrides.prescribed_info_received ?? (tc.protection.prescribedInformationGiven ? "yes" : "no");

  const unknown_slots: string[] = [];
  if (protected_status === "unknown") unknown_slots.push("protected_status");
  if (prescribed_info_received === "unknown") unknown_slots.push("prescribed_info_received");

  const property_address = tc.property.postcode
    ? `${tc.property.address}, ${tc.property.postcode}`
    : tc.property.address;

  const candidate = {
    deposit_amount: tc.deposit.amount,
    date_deposit_paid: tc.deposit.paidDate,
    tenancy_type: overrides.tenancy_type ?? "AST",
    country: overrides.country ?? "England",
    tenancy_start_date: tc.tenancy.startDate,
    protected_status,
    prescribed_info_received,
    tenancy_ended: tc.tenancy.ended,
    tenancy_end_date: tc.tenancy.endDate ?? null,
    deposit_returned: overrides.deposit_returned ?? false,
    amount_returned: overrides.amount_returned ?? 0,
    renewals_or_rollovers: overrides.renewals_or_rollovers ?? "none",
    landlord_or_agent: overrides.landlord_or_agent ?? "landlord",
    landlord_name: tc.landlord.name,
    landlord_address: tc.landlord.address ?? "",
    tenant_name: tc.tenant.name,
    tenant_address: tc.tenant.address ?? property_address,
    property_address,
    unknown_slots,
  };

  return DepositCaseSchema.parse(candidate);
}
