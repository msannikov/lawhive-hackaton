/**
 * Flight-delay playbook: UK Regulation (EC) 261/2004 (retained "UK261").
 *
 * Bundles the UK261-specific extraction schema, validator, decision tree and
 * tools arsenal behind the generic {@link Playbook} interface. `assess` is the
 * deterministic rules engine: facts → branch → toolset with concrete deadlines.
 *
 * Legal essence: a qualifying disruption (arrival delay ≥ 3h, cancellation with
 * under 14 days' notice, or denied boarding) on a UK261 route entitles the
 * passenger to FIXED compensation by great-circle distance — £220 (≤1500 km),
 * £350 (1500–3500 km), £520 (>3500 km) — UNLESS the operating carrier proves
 * extraordinary circumstances (severe weather, ATC restrictions, third-party
 * strikes; technical faults usually do NOT count). Enforce: airline → CAA / ADR
 * (AviationADR, CEDR) → County Court. Limitation: 6 years (England & Wales).
 */

import type { Playbook, CaseAssessment, EscalationSignal } from "../../core/types.ts";
import type { FlightDelayCase, FlightDelayBranch } from "./case.ts";
import {
  flightDelayJsonSchema,
  flightDelayGeminiSchema,
  EXTRACTION_INSTRUCTIONS,
} from "./schema.ts";
import { normalizeFlightDelayCase } from "./normalize.ts";
import { classify, BRANCH_LABELS } from "./decisionTree.ts";
import { computeKeyDates, COMPENSATION_BY_BAND } from "./keyDates.ts";
import { buildToolsForBranch } from "./toolsArsenal.ts";
import { formatUK } from "../../core/dates.ts";
import { buildNextMove } from "../../core/negotiation.ts";

/**
 * The decision gate. Negotiation = gather information before deciding; the user
 * stays self-serve while a written claim / ADR can still move things, and only
 * escalates to a human lawyer once that information-gathering is exhausted (the
 * user reports back a later `negotiationStage`).
 */
function escalationFor(c: FlightDelayCase, branch: FlightDelayBranch): EscalationSignal {
  const stage = c.negotiationStage ?? "initial";

  switch (branch) {
    case "ELIGIBLE":
      if (stage === "post_adr")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "ADR did not resolve a clearly eligible claim — a small claim is the next step; a lawyer can confirm the County Court paperwork.",
          triggers: ["adr_exhausted"],
        };
      return {
        level: "monitor",
        recommend: false,
        reason:
          "The fixed sum is a known figure — submit the claim yourself and use free ADR if the airline stalls. Escalate only if ADR fails.",
        triggers: ["watch:airline_response", "watch:adr_outcome"],
      };

    case "EXTRAORDINARY_CLAIMED":
      if (stage === "post_adr")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "The extraordinary-circumstances defence survived ADR — whether it is legally made out is contestable; a lawyer can advise on a County Court claim.",
          triggers: ["adr_exhausted", "contested_defence"],
        };
      return {
        level: "monitor",
        recommend: false,
        reason:
          "Put the burden back on the airline and test the defence through free ADR first. Escalate if ADR upholds a doubtful extraordinary-circumstances claim.",
        triggers: ["watch:extraordinary_defence"],
      };

    case "NOT_ELIGIBLE":
    default:
      return {
        level: "self_serve",
        recommend: false,
        reason:
          "No fixed compensation appears due — reclaim any right-to-care costs yourself. Re-check the delay length, and escalate only if it actually crossed 3 hours.",
        triggers: ["watch:threshold_recheck"],
      };
  }
}

function assess(c: FlightDelayCase): CaseAssessment {
  const k = computeKeyDates(c);
  const { branch, reasoning } = classify(c);
  const tools = buildToolsForBranch(branch, c, k);

  const amount = COMPENSATION_BY_BAND[c.flight.distanceBand];

  const keyDates: Record<string, string> = {
    "Flight date": formatUK(k.flightDate),
  };
  if (k.claimSubmittedDate) keyDates["Claim submitted"] = formatUK(k.claimSubmittedDate);
  if (branch !== "NOT_ELIGIBLE") {
    keyDates["Submit/renew claim by"] = formatUK(k.claimSendBy);
    keyDates["Airline response deadline"] = formatUK(k.airlineResponseDeadline);
    keyDates["Escalate to ADR by"] = formatUK(k.adrEscalateBy);
    keyDates["Small-claim longstop (6 yrs)"] = formatUK(k.claimLimitationLongstop);
  }

  const escalation = escalationFor(c, branch);
  const nextMove = buildNextMove(tools, escalation.recommend);

  const summary =
    `Matched branch "${BRANCH_LABELS[branch]}" (${escalation.level}) with ${tools.length} tool(s). ` +
    `${branch === "NOT_ELIGIBLE" ? "No fixed compensation" : `Fixed UK261 sum £${amount}`}. ` +
    `Next move: ${nextMove?.title ?? "none"}`;

  return {
    branch,
    branchLabel: BRANCH_LABELS[branch],
    summary,
    reasoning,
    keyDates,
    tools,
    nextMove,
    escalation,
  };
}

export const flightDelayPlaybook: Playbook<FlightDelayCase> = {
  id: "flight_delay",
  label: "UK261 flight delay / cancellation compensation",
  extraction: {
    instructions: EXTRACTION_INSTRUCTIONS,
    jsonSchema: flightDelayJsonSchema as unknown as Record<string, unknown>,
    geminiSchema: flightDelayGeminiSchema,
  },
  normalize: (raw, input, warnings) => normalizeFlightDelayCase(raw, input, warnings),
  assess,
};
