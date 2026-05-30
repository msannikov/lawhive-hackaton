/**
 * Shared negotiation framing used by every playbook.
 *
 * Premise (Never Split the Difference): negotiation is getting more information
 * before making a decision. Each tool is a move; this names what a given move is
 * FOR — gathering leverage, eliciting the other side's position, or the final
 * irreversible decision.
 */

import type { Tool, NextMove } from "./types.ts";

export function nextMoveRationale(tool: Tool): string {
  switch (tool.category) {
    case "verify":
    case "evidence":
      return "Gather your leverage first — this is the evidence your demand will stand on.";
    case "letter":
    case "chase":
      return "Your calibrated move: it's built to get a response and reveal the other side's position, not just assert a claim.";
    case "negotiation":
      return "Engage directly to surface what they actually want — more information, lower cost than court.";
    case "adr":
      return "Use the free, neutral process to resolve before court.";
    case "court":
      return "Information-gathering is exhausted — this is the decision step; consider a human lawyer.";
    default:
      return tool.deadlineBasis;
  }
}

/**
 * Builds the next move from a priority-ordered toolset.
 * Normally the first move (gather leverage / send the calibrated letter). When
 * escalating, it points at the decision step instead (court, else ADR).
 */
export function buildNextMove(tools: Tool[], escalate = false): NextMove | undefined {
  if (!tools.length) return undefined;
  const t = escalate
    ? tools.find((x) => x.category === "court") ?? tools.find((x) => x.category === "adr") ?? tools[tools.length - 1]!
    : tools[0]!;
  return { toolId: t.id, title: t.title, deadline: t.deadline, rationale: nextMoveRationale(t) };
}
