/**
 * Playbook registry. To add a legal domain: implement {@link Playbook} and
 * register it here. Nothing else in the system changes.
 */

import type { Playbook } from "../core/types.ts";
import { depositReturnPlaybook } from "./depositReturn/index.ts";
import { employmentTerminationPlaybook } from "./employmentTermination/index.ts";

export const PLAYBOOKS: Record<string, Playbook<any>> = {
  [depositReturnPlaybook.id]: depositReturnPlaybook,
  [employmentTerminationPlaybook.id]: employmentTerminationPlaybook,
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
