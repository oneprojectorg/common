'use client';

import { CollabAccessDeniedError } from '@/hooks/useTiptapCollab';
import { trpc } from '@op/api/client';
import { useCallback } from 'react';

import { getHttpStatus } from '../DevelopProposals/getHttpStatus';

/** Token resolver for a proposal's collaboration document; each call mints a fresh token. */
export function useProposalCollabToken(proposalProfileId: string) {
  const utils = trpc.useUtils();

  return useCallback(
    () =>
      utils.decision.getCollabToken.fetch({ proposalProfileId }).then(
        (result) => result.token,
        (error: unknown) => {
          // The token is gated like `updateProposal`, so a 403 means editing
          // has closed (for example, the phase locked), not an expired token.
          if (getHttpStatus(error) === 403) {
            throw new CollabAccessDeniedError('Proposal editing is closed', {
              cause: error,
            });
          }
          throw error;
        },
      ),
    [utils, proposalProfileId],
  );
}
