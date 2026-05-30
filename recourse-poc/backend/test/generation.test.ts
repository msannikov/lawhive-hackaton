import { describe, it, expect } from "vitest";
import { generateLetter } from "../src/generation";
import { validateClaims } from "../src/validator";
import { computeEligibility } from "../src/engines/eligibility";
import { computeQuantum } from "../src/engines/quantum";
import { computeDeadline } from "../src/engines/deadline";
import { CASES } from "../src/cases";

const jamie = CASES.jamie!.case;
const TODAY = new Date(2026, 4, 30);

describe("generation (offline fixture path)", () => {
  it("loads the Jamie fixture and EVERY claim passes the real validator", async () => {
    process.env.USE_FIXTURE = "1"; // force offline regardless of environment
    const engines = {
      eligibility: computeEligibility(jamie),
      quantum: computeQuantum(jamie),
      deadline: computeDeadline(jamie, TODAY),
    };

    const gen = await generateLetter(jamie, engines);
    expect(gen.source).toBe("fixture");

    // The offline fixture flows through the SAME validator as live output.
    const v = validateClaims(gen.emit);
    expect(v.ok).toBe(true);
    expect(v.claims).toHaveLength(5);
    expect(v.claims.every((c) => c.verified)).toBe(true);
    expect(v.failures).toHaveLength(0);
  });
});
