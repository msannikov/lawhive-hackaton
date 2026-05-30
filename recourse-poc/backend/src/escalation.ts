/**
 * Escalation router (spec §3.10) — pure function deciding one of three terminal
 * outcomes: proceed (automate a letter), escalate (hand to a regulated
 * solicitor), or refuse (out of scope). Design principle: ALWAYS over-escalate
 * rather than under-escalate — it is the regulatory-safe default.
 *
 * Pure and deterministic: it takes the case plus the engine outputs and returns
 * a decision with no side effects (the handoff package + id are built elsewhere).
 */
import type { DepositCase, EligibilityResult, DeadlineResult, EscalationDecision } from "./models";

export function routeEscalation(
  c: DepositCase,
  eligibility: EligibilityResult,
  deadline: DeadlineResult,
): EscalationDecision {
  // 1. Out of scope → refuse cleanly and explain (hard scope boundary, §1).
  if (!eligibility.in_scope) {
    return { kind: "refuse", escalate: false, reasons: [outOfScopeReason(c)], handoff_package_id: null };
  }

  // 2. In scope but no breach found → there is nothing to claim.
  if (!eligibility.breach) {
    return {
      kind: "refuse",
      escalate: false,
      reasons: [
        "No breach detected: the deposit appears to have been protected and the prescribed information given within time.",
      ],
      handoff_package_id: null,
    };
  }

  // 3. In scope + breached, but complex or risky → escalate to a human.
  const reasons: string[] = [];
  if (c.renewals_or_rollovers === "multiple") {
    reasons.push(
      "Multiple tenancy roll-overs can trigger fresh protection obligations and multiple penalties (Superstrike v Rodrigues; Deregulation Act 2015) — fact-sensitive, not safe to automate.",
    );
  }
  if (deadline.status === "critical") {
    reasons.push(
      `Limitation expires in ${deadline.days_remaining} days (${deadline.limitation_expiry}) — too close to risk an automated route.`,
    );
  }
  const unknowns = collectUnknowns(c);
  if (unknowns.length > 0) {
    reasons.push(`Unresolved facts after intake: ${unknowns.join(", ")}.`);
  }

  if (reasons.length > 0) {
    return { kind: "escalate", escalate: true, reasons, handoff_package_id: null };
  }

  // 4. Safe to proceed with an automated, fully-grounded letter.
  return { kind: "proceed", escalate: false, reasons: [], handoff_package_id: null };
}

function outOfScopeReason(c: DepositCase): string {
  const bits: string[] = [];
  if (c.tenancy_type !== "AST")
    bits.push("the arrangement is not an assured shorthold tenancy (e.g. a lodger, licence, resident-landlord or company let)");
  if (c.country === "other") bits.push("the property is not in England or Wales");
  if (c.tenancy_start_date < "2007-04-06")
    bits.push("the tenancy began before deposit protection started on 6 April 2007");
  if (c.deposit_amount <= 0) bits.push("no money deposit was taken");
  if (bits.length === 0) bits.push("the case falls outside the tenancy-deposit protection regime");
  return "Out of scope: " + bits.join("; ") + ".";
}

function collectUnknowns(c: DepositCase): string[] {
  const u: string[] = [...c.unknown_slots];
  if (c.protected_status === "unknown") u.push("whether the deposit was protected");
  if (c.prescribed_info_received === "unknown") u.push("whether the prescribed information was given");
  return u;
}
