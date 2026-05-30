/**
 * The UK261 decision tree, as code.
 *
 *   Disrupted flight on a UK261 route?
 *     └─ Qualifying trigger?  (arrival delay ≥ 3h, OR cancellation with < 14
 *        days' notice, OR denied boarding)
 *          ├─ No  → NOT_ELIGIBLE          (no fixed compensation; right to care only)
 *          └─ Yes → Does the airline rely on extraordinary circumstances?
 *                    ├─ Yes, and plausibly genuine (weather / ATC / 3rd-party
 *                    │       strike)              → EXTRAORDINARY_CLAIMED (assess/challenge)
 *                    └─ No, or reason is within the carrier's control (e.g.
 *                            technical)           → ELIGIBLE (claim the fixed sum)
 *
 * Compensation is a FIXED sum by great-circle distance: £220 (≤1500 km),
 * £350 (1500–3500 km), £520 (>3500 km).
 */

import type { FlightDelayBranch, FlightDelayCase } from "./case.ts";
import { computeKeyDates, COMPENSATION_BY_BAND, BAND_DESCRIPTION } from "./keyDates.ts";
import { formatUK } from "../../core/dates.ts";

export interface Classification {
  branch: FlightDelayBranch;
  reasoning: string[];
}

export const BRANCH_LABELS: Record<FlightDelayBranch, string> = {
  ELIGIBLE: "Eligible → claim the fixed UK261 compensation",
  EXTRAORDINARY_CLAIMED: "Airline claims extraordinary circumstances → assess/challenge",
  NOT_ELIGIBLE: "Not eligible → right to care only",
};

const QUALIFYING_DELAY_HOURS = 3;
const CANCELLATION_NOTICE_THRESHOLD_DAYS = 14;

/**
 * Node 1: did a qualifying trigger occur?
 *  - delay: arrived 3+ hours late at the destination;
 *  - cancellation: cancelled with fewer than 14 days' notice;
 *  - denied boarding: always qualifies (involuntary).
 * Returns null when the facts are too thin to say either way (treated as
 * eligible-but-review downstream so the user is never wrongly told "no claim").
 */
function qualifyingTrigger(c: FlightDelayCase): boolean | null {
  switch (c.disruption.type) {
    case "denied_boarding":
      return true;
    case "cancellation":
      if (c.cancellationNoticeDays == null) return null;
      return c.cancellationNoticeDays < CANCELLATION_NOTICE_THRESHOLD_DAYS;
    case "delay":
      if (c.timings.arrivalDelayHours == null) return null;
      return c.timings.arrivalDelayHours >= QUALIFYING_DELAY_HOURS;
    default:
      // Unknown type: fall back to the delay figure if we have one.
      if (c.timings.arrivalDelayHours == null) return null;
      return c.timings.arrivalDelayHours >= QUALIFYING_DELAY_HOURS;
  }
}

export function classify(c: FlightDelayCase): Classification {
  const reasoning: string[] = [];
  const k = computeKeyDates(c);
  const amount = COMPENSATION_BY_BAND[c.flight.distanceBand];

  reasoning.push(
    `Flight ${c.flight.flightNumber} (${c.flight.airline}) ${c.flight.origin} → ` +
      `${c.flight.destination} on ${formatUK(k.flightDate)}.`,
  );
  reasoning.push(
    `Journey distance ${c.flight.distanceKm != null ? `${c.flight.distanceKm} km` : "unstated"} ` +
      `→ ${BAND_DESCRIPTION[c.flight.distanceBand]} band → fixed UK261 sum £${amount}.`,
  );

  // --- Route gate: is this a UK261 flight at all? ---
  if (!c.flight.ukOrEuRoute) {
    reasoning.push(
      "Flight is neither a UK departure nor a UK/EU carrier arriving in the UK → UK261 does not apply; right to care does not arise here.",
    );
    return { branch: "NOT_ELIGIBLE", reasoning };
  }

  // --- Node 1: qualifying trigger? ---
  const qualifies = qualifyingTrigger(c);
  if (c.disruption.type === "delay") {
    reasoning.push(
      c.timings.arrivalDelayHours != null
        ? `Arrival delay of ${c.timings.arrivalDelayHours}h (threshold is ${QUALIFYING_DELAY_HOURS}h).`
        : "Arrival delay length not stated.",
    );
  } else if (c.disruption.type === "cancellation") {
    reasoning.push(
      c.cancellationNoticeDays != null
        ? `Cancellation with ${c.cancellationNoticeDays} days' notice (threshold is ${CANCELLATION_NOTICE_THRESHOLD_DAYS} days).`
        : "Cancellation notice period not stated.",
    );
  } else if (c.disruption.type === "denied_boarding") {
    reasoning.push("Denied boarding → a qualifying trigger in itself.");
  }

  if (qualifies === false) {
    reasoning.push(
      "No qualifying trigger (under the 3-hour delay, or 14+ days' cancellation notice) → no fixed compensation; only the right to care (meals/accommodation) may apply.",
    );
    return { branch: "NOT_ELIGIBLE", reasoning };
  }
  if (qualifies === null) {
    reasoning.push(
      "Trigger threshold cannot be confirmed from the documents → treat as potentially eligible and verify the exact delay/notice before claiming.",
    );
  }

  // --- Node 2: extraordinary circumstances? ---
  if (c.disruption.extraordinaryClaimed) {
    const cat = c.disruption.reasonCategory;
    const reason = c.disruption.reasonGiven ? ` ("${c.disruption.reasonGiven}")` : "";
    if (cat === "technical") {
      reasoning.push(
        `Airline blames a technical fault${reason}. Technical/maintenance issues are generally WITHIN the carrier's control and usually do NOT amount to extraordinary circumstances → the claim remains strong.`,
      );
      return { branch: "ELIGIBLE", reasoning };
    }
    reasoning.push(
      `Airline relies on extraordinary circumstances${reason}${cat ? ` (${cat})` : ""}. ` +
        "Severe weather, ATC restrictions and third-party strikes CAN qualify — but the airline must PROVE it, that it was beyond its control, and that it took all reasonable measures.",
    );
    return { branch: "EXTRAORDINARY_CLAIMED", reasoning };
  }

  reasoning.push(
    `Qualifying disruption with no extraordinary-circumstances defence → eligible for the fixed UK261 sum of £${amount}.`,
  );
  return { branch: "ELIGIBLE", reasoning };
}
