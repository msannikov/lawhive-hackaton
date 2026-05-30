import { describe, it, expect } from "vitest";
import { computeEligibility } from "../src/engines/eligibility";
import { computeQuantum } from "../src/engines/quantum";
import { computeDeadline } from "../src/engines/deadline";
import { CASES } from "../src/cases";

const jamie = CASES.jamie!.case;
const lodger = CASES.lodger!.case;

// Pin "today" to the demo date (2026-05-30) so deadline arithmetic is deterministic.
const TODAY = new Date(2026, 4, 30); // month is 0-indexed → May

describe("eligibility engine (§3.3)", () => {
  it("Jamie: in scope, breach on both s213(3) and s213(6), reasons R1/R2/R4", () => {
    const r = computeEligibility(jamie);
    expect(r.in_scope).toBe(true);
    expect(r.breach).toBe(true);
    expect(r.breach_types).toEqual(["s213(3)", "s213(6)"]);
    expect(r.reasons).toEqual(["R1", "R2", "R4"]);
  });

  it("Lodger: out of scope (not an AST)", () => {
    const r = computeEligibility(lodger);
    expect(r.in_scope).toBe(false);
  });
});

describe("quantum engine (§3.4)", () => {
  it("Jamie: penalty range £980–£2,940, deposit return £980, basis R6/R7", () => {
    const r = computeQuantum(jamie);
    expect(r.penalty_min).toBe(980);
    expect(r.penalty_max).toBe(2940);
    expect(r.deposit_return).toBe(980);
    expect(r.tenancy_count).toBe(1);
    expect(r.basis).toEqual(["R6", "R7"]);
    expect(r.discretion_note_ref).toBe("R11");
  });

  it("computes in pence with no float drift for an awkward amount", () => {
    const r = computeQuantum({ ...jamie, deposit_amount: 1012.1, amount_returned: 0 });
    expect(r.penalty_min).toBe(1012.1);
    expect(r.penalty_max).toBe(3036.3); // 1012.10 × 3 — exact, not 3036.2999…
  });
});

describe("deadline engine (§3.5)", () => {
  it("Jamie: limitation 2030-10-01, 1585 days remaining, ample; 14-day response window", () => {
    const r = computeDeadline(jamie, TODAY);
    expect(r.limitation_expiry).toBe("2030-10-01");
    expect(r.days_remaining).toBe(1585);
    expect(r.status).toBe("ample");
    expect(r.lbc_response_deadline).toBe("2026-06-13");
    expect(r.uncertainty_flag).toBe(true);
    expect(r.basis).toEqual(["R10"]);
  });

  it("flags critical when limitation is under 30 days away", () => {
    // Deposit paid ~6 years before today → expiry within days.
    const r = computeDeadline({ ...jamie, date_deposit_paid: "2020-05-20" }, TODAY);
    expect(r.status).toBe("critical");
  });
});
