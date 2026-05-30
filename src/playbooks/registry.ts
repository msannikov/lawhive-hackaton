/**
 * Playbook registry. To add a legal domain: implement {@link Playbook} and
 * register it here. Nothing else in the system changes.
 */

import type { Playbook } from "../core/types.ts";
import { depositReturnPlaybook } from "./depositReturn/index.ts";
import { employmentTerminationPlaybook } from "./employmentTermination/index.ts";
import { consumerServicesPlaybook } from "./consumerServices/index.ts";
import { faultyGoodsPlaybook } from "./faultyGoods/index.ts";
import { flightDelayPlaybook } from "./flightDelay/index.ts";
import { unfairTermsPlaybook } from "./unfairTerms/index.ts";
import { unpaidWagesPlaybook } from "./unpaidWages/index.ts";
import { housingDisrepairPlaybook } from "./housingDisrepair/index.ts";
import { buildingDisputePlaybook } from "./buildingDispute/index.ts";
import { unfairDismissalPlaybook } from "./unfairDismissal/index.ts";
import { smallClaimsNuisancePlaybook } from "./smallClaimsNuisance/index.ts";

export const PLAYBOOKS: Record<string, Playbook<any>> = {
  [depositReturnPlaybook.id]: depositReturnPlaybook,
  [employmentTerminationPlaybook.id]: employmentTerminationPlaybook,
  [consumerServicesPlaybook.id]: consumerServicesPlaybook,
  [faultyGoodsPlaybook.id]: faultyGoodsPlaybook,
  [flightDelayPlaybook.id]: flightDelayPlaybook,
  [unfairTermsPlaybook.id]: unfairTermsPlaybook,
  [unpaidWagesPlaybook.id]: unpaidWagesPlaybook,
  [housingDisrepairPlaybook.id]: housingDisrepairPlaybook,
  [buildingDisputePlaybook.id]: buildingDisputePlaybook,
  [unfairDismissalPlaybook.id]: unfairDismissalPlaybook,
  [smallClaimsNuisancePlaybook.id]: smallClaimsNuisancePlaybook,
};

export const DEFAULT_DOMAIN = depositReturnPlaybook.id;

export function getPlaybook(domain?: string): Playbook<any> {
  const id = domain ?? DEFAULT_DOMAIN;
  const playbook = PLAYBOOKS[id];
  if (!playbook) {
    throw new Error(
      `Unknown domain "${id}". Available: ${Object.keys(PLAYBOOKS).join(", ")}`,
    );
  }
  return playbook;
}

export { depositReturnPlaybook } from "./depositReturn/index.ts";
export { employmentTerminationPlaybook } from "./employmentTermination/index.ts";
export { consumerServicesPlaybook } from "./consumerServices/index.ts";
export { faultyGoodsPlaybook } from "./faultyGoods/index.ts";
export { flightDelayPlaybook } from "./flightDelay/index.ts";
export { unfairTermsPlaybook } from "./unfairTerms/index.ts";
export { unpaidWagesPlaybook } from "./unpaidWages/index.ts";
export { housingDisrepairPlaybook } from "./housingDisrepair/index.ts";
export { buildingDisputePlaybook } from "./buildingDispute/index.ts";
export { unfairDismissalPlaybook } from "./unfairDismissal/index.ts";
export { smallClaimsNuisancePlaybook } from "./smallClaimsNuisance/index.ts";
