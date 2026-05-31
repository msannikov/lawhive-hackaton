import { describe, it, expect, beforeAll } from "vitest";
import { classifyLandlordResponse } from "../src/classifyResponse";

// Force the offline heuristic path (deterministic, no API key needed).
beforeAll(() => {
  process.env.USE_FIXTURE = "1";
});

describe("classifyResponse — domain-neutral heuristic", () => {
  it("employer settlement offer → disputes_deductions", async () => {
    const r = await classifyLandlordResponse(
      "We dispute that your dismissal was unfair — it was a genuine redundancy. Without admission of liability, we are willing to offer you £2,500 as full and final settlement.",
      "unfair_dismissal",
    );
    expect(r.landlordResponse).toBe("disputes_deductions");
    expect(r.source).toBe("heuristic");
  });

  it("employer agreeing to resolve → agrees_in_full", async () => {
    const r = await classifyLandlordResponse(
      "Having reviewed your letter, we agree the dismissal was not handled fairly. We are happy to reinstate you and settle your notice and holiday pay.",
      "unfair_dismissal",
    );
    expect(r.landlordResponse).toBe("agrees_in_full");
  });

  it("holding reply → unknown", async () => {
    const r = await classifyLandlordResponse(
      "We acknowledge receipt of your letter and will respond once we have taken advice. We will be in touch in due course.",
      "unfair_dismissal",
    );
    expect(r.landlordResponse).toBe("unknown");
  });

  it("negation 'do not accept … deny' → disputes_deductions (not agrees)", async () => {
    const r = await classifyLandlordResponse(
      "We do not accept that the dismissal was unfair and we deny any discrimination.",
      "unfair_dismissal",
    );
    expect(r.landlordResponse).toBe("disputes_deductions");
  });

  it("still works for the original deposit domain", async () => {
    const dispute = await classifyLandlordResponse(
      "I'll return your deposit minus £150 for cleaning.",
      "deposit_return",
    );
    expect(dispute.landlordResponse).toBe("disputes_deductions");

    const agree = await classifyLandlordResponse("I agree to refund your full deposit.", "deposit_return");
    expect(agree.landlordResponse).toBe("agrees_in_full");
  });

  it("empty message → unknown", async () => {
    const r = await classifyLandlordResponse("", "unfair_dismissal");
    expect(r.landlordResponse).toBe("unknown");
  });
});
