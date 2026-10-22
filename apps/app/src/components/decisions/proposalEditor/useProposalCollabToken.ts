'use client';

import { trpc } from '@op/api/client';
import { useCallback } from 'react';

/** Token resolver for a proposal's collaboration document; each call mints a fresh token. */
export function useProposalCollabToken(proposalProfileId: string) {
  const utils = trpc.useUtils();

  return useCallback(
    () =>
      utils.decision.getCollabToken
        .fetch({ proposalProfileId })
        .then((result) => result.token),
    [utils, proposalProfileId],
  );
}
