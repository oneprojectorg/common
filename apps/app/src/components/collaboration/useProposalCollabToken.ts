'use client';

import { trpc } from '@op/api/client';
import { useCallback } from 'react';

/** Refetch a token once it is five minutes old; the JWT itself lives an hour. */
const TOKEN_STALE_TIME_MS = 5 * 60 * 1000;

/** Keep the mount-time suspense query from refetching inside the token's life. */
const INITIAL_STALE_TIME_MS = 50 * 60 * 1000;

/**
 * Resolve Tiptap Cloud collaboration tokens for one proposal.
 *
 * The first fetch is a suspense query, so a FORBIDDEN or NOT_FOUND from the
 * endpoint reaches the surrounding `ResourceErrorBoundary` as a 403/404 page
 * instead of a silent failure to connect. The returned resolver is memoized
 * (a new identity would rebuild the Tiptap provider) and awaited again on
 * every reconnect — the cache serves the same token until it goes stale.
 */
export function useProposalCollabToken({
  proposalProfileId,
}: {
  proposalProfileId: string;
}): () => Promise<string> {
  const utils = trpc.useUtils();

  trpc.decision.getCollabToken.useSuspenseQuery(
    { proposalProfileId },
    { staleTime: INITIAL_STALE_TIME_MS, refetchOnWindowFocus: false },
  );

  return useCallback(
    () =>
      utils.decision.getCollabToken
        .fetch({ proposalProfileId }, { staleTime: TOKEN_STALE_TIME_MS })
        .then((result) => result.token),
    [utils, proposalProfileId],
  );
}
