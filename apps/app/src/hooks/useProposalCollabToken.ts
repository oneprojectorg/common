'use client';

import { trpc } from '@op/api/client';
import { useCallback, useMemo } from 'react';

// The token lives 30 minutes.
const TOKEN_STALE_TIME_MS = 5 * 60 * 1000;
const INITIAL_STALE_TIME_MS = 25 * 60 * 1000;

/**
 * The first fetch suspends so a 403/404 reaches the error boundary. The
 * provider awaits `getToken` on every reconnect; `refreshToken` drops the
 * cached token.
 */
export function useProposalCollabToken({
  proposalProfileId,
}: {
  proposalProfileId: string;
}): { getToken: () => Promise<string>; refreshToken: () => void } {
  const utils = trpc.useUtils();

  trpc.decision.getCollabToken.useSuspenseQuery(
    { proposalProfileId },
    { staleTime: INITIAL_STALE_TIME_MS, refetchOnWindowFocus: false },
  );

  const getToken = useCallback(
    () =>
      utils.decision.getCollabToken
        .fetch({ proposalProfileId }, { staleTime: TOKEN_STALE_TIME_MS })
        .then((result) => result.token),
    [utils, proposalProfileId],
  );

  const refreshToken = useCallback(() => {
    void utils.decision.getCollabToken.invalidate({ proposalProfileId });
  }, [utils, proposalProfileId]);

  return useMemo(() => ({ getToken, refreshToken }), [getToken, refreshToken]);
}
