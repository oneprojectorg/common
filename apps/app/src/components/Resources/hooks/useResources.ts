'use client';

import { trpc } from '@op/api/client';

export const useResources = (profileId: string) => {
  return trpc.resources.list.useSuspenseQuery(
    { profileId },
    { staleTime: 30 * 1000 },
  );
};
