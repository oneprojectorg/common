'use client';

import { trpc } from '@op/api/client';
import { areCommentsAllowed } from '@op/common/client';

/**
 * `getInstance` is already fetched on every route that renders a comment
 * surface, so this reads the react-query cache rather than issuing a request.
 */
export function useCommentsAllowed(instanceId: string): boolean {
  const { data: instance } = trpc.decision.getInstance.useQuery({ instanceId });

  return areCommentsAllowed({
    phases: instance?.instanceData?.phases ?? [],
    currentPhaseId: instance?.currentStateId,
  });
}
