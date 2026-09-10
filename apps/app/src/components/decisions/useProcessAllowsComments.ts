'use client';

import { trpc } from '@op/api/client';
import { areCommentsAllowed } from '@op/common/client';

/**
 * Whether the process takes comments — the Process Builder's "Allow comments"
 * toggle, read off the instance the surface already belongs to.
 *
 * Reads through `decision.getInstance` rather than taking the flag as a prop.
 * Every route that renders a comment surface already has that query in the
 * react-query cache (the proposal list, the results page, the review summary
 * and the phase router all fetch it), so this resolves synchronously from the
 * cache and costs no request. A `proposal` carries its `processInstanceId`, so
 * even a card three levels down can ask for itself instead of being handed the
 * answer — which is what keeps a surface nobody remembered to wire from
 * silently showing a control the process has turned off.
 *
 * Absent data reads as allowed, matching an unconfigured process
 * (`areCommentsAllowed`). The server re-derives the rule on every write, so the
 * worst a cold cache costs is a control that fails on click.
 */
export function useProcessAllowsComments(instanceId: string): boolean {
  const { data: instance } = trpc.decision.getInstance.useQuery({ instanceId });

  return areCommentsAllowed(instance?.instanceData);
}
