import { cache } from '@op/cache';
import { Channels, getPermissionsOnProposal, getProposal } from '@op/common';
import { proposalSchema } from '@op/common/client';
import { ProposalStatus } from '@op/db/schema';
import { logger } from '@op/logging';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const getProposalRouter = router({
  getProposal: networkAuthenticatedProcedure()
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
      const proposal = await cache({
        type: 'profile',
        params: [profileId],
        fetch: () =>
          getProposal({
            profileId,
            user,
          }),
        options: {
          skipCacheWrite: (result) => result.status === ProposalStatus.DRAFT,
        },
      });

      // Fetch permissions
      const { access } = await getPermissionsOnProposal({
        user,
        proposal,
      }).catch((error) => {
        logger.error('Error getting permissions on proposal', {
          error,
          profileId,
        });
        return { access: undefined };
      });

      ctx.registerQueryChannels([
        Channels.decisionProposal(proposal.processInstanceId, proposal.id),
      ]);

      return proposalSchema.parse({
        ...proposal,
        isEditable: access?.update,
        access,
      });
    }),
});
