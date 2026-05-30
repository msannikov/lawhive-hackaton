import { describe, it, expect } from "vitest";
import { routeEscalation } from "../src/escalation";
import { computeEligibility } from "../src/engines/eligibility";
import { computeDeadline } from "../src/engines/deadline";
import { CASES } from "../src/cases";

const TODAY = new Date(2026, 4, 30); // 2026-05-30

function route(caseId: keyof typeof CASES) {
  const c = CASES[caseId]!.case;
  return routeEscalation(c, computeEligibility(c), computeDeadline(c, TODAY));
}

describe("escalation router (§3.10) — three terminal outcomes", () => {
  it("Jamie → proceed (clean breach, in scope, ample time)", () => {
    const d = route("jamie");
    expect(d.kind).toBe("proceed");
    expect(d.escalate).toBe(false);
  });

  it("Multiple renewals → escalate (Superstrike complexity, R9)", () => {
    const d = route("renewals");
    expect(d.kind).toBe("escalate");
    expect(d.escalate).toBe(true);
    expect(d.reasons.join(" ")).toMatch(/roll-overs|Superstrike/i);
  });

  it("Lodger → refuse (out of scope, not an AST)", () => {
    const d = route("lodger");
    expect(d.kind).toBe("refuse");
    expect(d.escalate).toBe(false);
    expect(d.reasons.join(" ")).toMatch(/out of scope|assured shorthold/i);
  });

  it("escalates on a critical limitation deadline", () => {
    const c = { ...CASES.jamie!.case, date_deposit_paid: "2020-05-20" };
    const d = routeEscalation(c, computeEligibility(c), computeDeadline(c, TODAY));
    expect(d.kind).toBe("escalate");
    expect(d.reasons.join(" ")).toMatch(/Limitation expires/i);
  });
});
