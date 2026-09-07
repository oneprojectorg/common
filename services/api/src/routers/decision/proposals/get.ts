import { Channels, getPermissionsOnProposal, getProposal } from '@op/common';
import { proposalSchema } from '@op/common/client';
import { logger } from '@op/logging';
import { z } from 'zod';

import { openProcedure, router } from '../../../trpcFactory';

export const getProposalRouter = router({
  /**
   * NOTE: not wrapped in a shared `cache()` here. The cache key is keyed by
   * profileId only (no caller identity), so a cache hit would serve the
   * proposal to a non-member and bypass the authz inside `getProposal`. The
   * proposal is fetched (and authorized) on every request.
   */
  getProposal: openProcedure()
    .input(
      z.object({
        profileId: z.uuid(),
      }),
    )
    .output(proposalSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileId } = input;

      // Fetch proposal (includes documentContent)
      const proposal = await getProposal({
        profileId,
        user,
      });

      // Fetch permissions
      const { access, isEditable } = await getPermissionsOnProposal({
        user,
        proposal,
      }).catch((error) => {
        logger.error('Error getting permissions on proposal', {
          error,
          profileId,
        });
        return { access: undefined, isEditable: false };
      });

      ctx.registerQueryChannels([
        Channels.decisionProposal(proposal.processInstanceId, proposal.id),
      ]);

      return proposalSchema.parse({
        ...proposal,
        isEditable,
        access,
      });
    }),
});
