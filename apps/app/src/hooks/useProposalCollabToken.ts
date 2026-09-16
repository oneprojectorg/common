'use client';

import { trpc } from '@op/api/client';
import { useCallback } from 'react';

/**
 * The edit page has no access check of its own, so the first token fetch is
 * done during render: a caller the API refuses gets the 403/404 page instead
 * of an editor that never connects. Its result is unused; the provider fetches
 * its own tokens through the returned resolver.
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
