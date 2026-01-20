import { cache } from '@op/cache';
import { getPermissionsOnProposal, getProposal } from '@op/common';
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
      let { profileId } = input;

      // Adding this map since we are shifting when there is only one proposal.
      // Preventing 404s for the moment but this can be removed in a short bit.
      if (profileId === '168e431e-60cd-4834-9ab4-36cc9fbafd8a') {
        profileId = 'e05db18a-7c18-4cd5-90fc-a33e25a257b1';
      }

      const proposal = await cache({
        type: 'profile',
        params: [profileId],
        fetch: () =>
          getProposal({
            profileId,
            user,
          }),
        options: {
          skipMemCache: true, // We need these to be editable and then immediately accessible
        },
      });

      // Don't cache permission
      try {
        proposal.isEditable = await getPermissionsOnProposal({
          user,
          proposal,
        });
      } catch (error) {
        logger.error('Error getting permissions on proposal', {
          error,
          profileId,
        });
      }

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

      return proposalEncoder.parse(proposal);
    }),
});
