'use client';

import { trpc } from '@op/api/client';
import { useCallback } from 'react';

/** Suspends on the first fetch so a 403/404 reaches the error boundary. */
export function useProposalCollabToken({
  proposalProfileId,
}: {
  proposalProfileId: string;
}): () => Promise<string> {
  const utils = trpc.useUtils();

  trpc.decision.getCollabToken.useSuspenseQuery(
    { proposalProfileId },
    { refetchOnWindowFocus: false },
  );

  return useCallback(
    () =>
      utils.decision.getCollabToken
        .fetch({ proposalProfileId })
        .then((result) => result.token),
    [utils, proposalProfileId],
  );
}
