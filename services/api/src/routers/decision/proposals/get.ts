import { cache } from '@op/cache';
import { getPermissionsOnProposal, getProposal } from '@op/common';
import { ProposalStatus } from '@op/db/schema';
import { logger } from '@op/logging';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { proposalEncoder } from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';
import { trackProposalViewed } from '../../../utils/analytics';

export const getProposalRouter = router({
  getProposal: commonAuthedProcedure()
    .input(
      z.object({
        profileId: z.uuid(),
      }),
    )
    .output(proposalEncoder)
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

      // Track proposal viewed event
      if (
        proposal.processInstance &&
        typeof proposal.processInstance === 'object' &&
        !Array.isArray(proposal.processInstance) &&
        'id' in proposal.processInstance
      ) {
        waitUntil(
          trackProposalViewed(ctx, proposal.processInstance.id, proposal.id),
        );
      }

      return proposalEncoder.parse({
        ...proposal,
        isEditable: access?.update,
        access,
      });
    }),
});
