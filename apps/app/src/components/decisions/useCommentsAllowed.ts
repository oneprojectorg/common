'use client';

import { useTRPC } from '@op/api/client';
import { areCommentsAllowed } from '@op/common/client';
import { useQuery } from '@tanstack/react-query';

/**
 * `getInstance` is already fetched on every route that renders a comment
 * surface, so this reads the react-query cache rather than issuing a request.
 */
export function useCommentsAllowed(instanceId: string): boolean {
  const trpc = useTRPC();
  const { data: instance } = useQuery(
    trpc.decision.getInstance.queryOptions({ instanceId }),
  );

  return areCommentsAllowed({
    phases: instance?.instanceData?.phases ?? [],
    currentPhaseId: instance?.currentStateId,
  });
}
