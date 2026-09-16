'use client';

import { trpc } from '@op/api/client';
import { useCallback } from 'react';

/**
 * The first fetch suspends so a 403/404 reaches the error boundary. The
 * provider awaits `getToken` on every reconnect and gets a fresh token.
 */
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
