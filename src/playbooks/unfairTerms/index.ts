/**
 * Unfair-terms playbook: UK consumer contracts (Consumer Rights Act 2015 Part 2).
 *
 * The worked example is a gym membership with an onerous lock-in / auto-renewal /
 * cancellation charge, now chased by a debt collector. Bundles the
 * unfair-terms-specific extraction schema, validator, decision tree and tools
 * arsenal behind the generic {@link Playbook} interface. The `assess` function
 * is the deterministic rules engine.
 */

import type { Playbook, CaseAssessment, EscalationSignal } from "../../core/types.ts";
import type { UnfairTermsCase, UnfairTermsBranch } from "./case.ts";
import {
  unfairTermsJsonSchema,
  unfairTermsGeminiSchema,
  EXTRACTION_INSTRUCTIONS,
} from "./schema.ts";
import { normalizeUnfairTermsCase } from "./normalize.ts";
import { classify, BRANCH_LABELS } from "./decisionTree.ts";
import { computeKeyDates } from "./keyDates.ts";
import { buildToolsForBranch } from "./toolsArsenal.ts";
import { formatUK } from "../../core/dates.ts";
import { buildNextMove } from "../../core/negotiation.ts";

/**
 * The decision gate. Negotiation = gather information before deciding; the user
 * stays self-serve while a written dispute / letter can still move things, and
 * only escalates to a human lawyer once that information-gathering is exhausted
 * (the user reports back a later `negotiationStage`).
 */
function escalationFor(c: UnfairTermsCase, branch: UnfairTermsBranch): EscalationSignal {
  const stage = c.negotiationStage ?? "initial";

  switch (branch) {
    case "UNFAIR_TERM_LIKELY":
      if (stage === "post_complaint")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "The gym/collector pressed on after your dispute and complaint — a lawyer can advise on " +
            "defending any claim or bringing a small claim; the unfairness argument is fact-sensitive.",
          triggers: ["dispute_exhausted"],
        };
      return {
        level: "monitor",
        recommend: false,
        reason:
          "Dispute the debt and assert the term is non-binding yourself first. Escalate only if they " +
          "keep enforcing after your letters or actually issue a claim.",
        triggers: ["watch:enforcement_after_dispute"],
      };

    case "AGGRESSIVE_COLLECTION":
      if (stage !== "initial")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "Aggressive or misleading collection continued after your complaint — escalate to the " +
            "Financial Ombudsman / FCA, and take legal advice if it does not stop.",
          triggers: ["conc_breach_continued"],
        };
      return {
        level: "monitor",
        recommend: false,
        reason:
          "Dispute and complain under FCA CONC first; this is free and usually stops improper " +
          "collection. Escalate to the Ombudsman/FCA only if it continues.",
        triggers: ["watch:collection_conduct"],
      };

    case "ARGUABLE":
    default:
      if (stage !== "initial")
        return {
          level: "escalate",
          recommend: true,
          reason:
            "Negotiation did not resolve an arguable term — a lawyer can advise on settlement value " +
            "or defending a claim before you commit either way.",
          triggers: ["negotiation_stalled"],
        };
      return {
        level: "monitor",
        recommend: false,
        reason:
          "The term is arguable: dispute to pause collection, then negotiate a reduced settlement " +
          "yourself. Bring in a lawyer only if a claim is issued or the numbers are high-value.",
        triggers: ["watch:before_settlement"],
      };
  }
}

function assess(c: UnfairTermsCase): CaseAssessment {
  const k = computeKeyDates(c);
  const { branch, reasoning } = classify(c);
  const tools = buildToolsForBranch(branch, c, k);

  const keyDates: Record<string, string> = {
    "Membership start": formatUK(k.membershipStartDate),
    "Minimum term ends": formatUK(k.minimumTermEndDate),
    "Dispute the debt by": formatUK(k.disputeCollectorSendBy),
    "Collector pause / response by": formatUK(k.collectorPauseDeadline),
  };
  if (k.cancellationAttemptDate)
    keyDates["Cancellation attempted"] = formatUK(k.cancellationAttemptDate);
  if (branch !== "AGGRESSIVE_COLLECTION")
    keyDates["Gym response deadline"] = formatUK(k.gymResponseDeadline);
  keyDates["Limitation longstop (6 yrs)"] = formatUK(k.limitationLongstop);

  const escalation = escalationFor(c, branch);
  const nextMove = buildNextMove(tools, escalation.recommend);

  const summary =
    `Matched branch "${BRANCH_LABELS[branch]}" (${escalation.level}) with ${tools.length} tool(s). ` +
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

export const unfairTermsPlaybook: Playbook<UnfairTermsCase> = {
  id: "unfair_terms",
  label: "UK consumer contracts — unfair terms (gym membership)",
  extraction: {
    instructions: EXTRACTION_INSTRUCTIONS,
    jsonSchema: unfairTermsJsonSchema as unknown as Record<string, unknown>,
    geminiSchema: unfairTermsGeminiSchema,
  },
  normalize: (raw, input, warnings) => normalizeUnfairTermsCase(raw, input, warnings),
  assess,
};
