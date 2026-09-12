'use client';

import { useTRPC } from '@op/api/client';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/** Token resolver for a proposal's collaboration document; each call mints a fresh token. */
export function useProposalCollabToken(proposalProfileId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(
    () =>
      queryClient
        .fetchQuery(
          trpc.decision.getCollabToken.queryOptions({ proposalProfileId }),
        )
        .then((result) => result.token),
    [queryClient, trpc, proposalProfileId],
  );
}
