'use client';

import { trpc } from '@op/api/client';
import { areCommentsAllowed } from '@op/common/client';

/**
 * `getInstance` is already fetched on every route that renders a comment
 * surface, so this reads the react-query cache rather than issuing a request.
 */
export function useProcessAllowsComments(instanceId: string): boolean {
  const { data: instance } = trpc.decision.getInstance.useQuery({ instanceId });

  return areCommentsAllowed(instance?.instanceData);
}
