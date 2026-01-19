import { cache } from '@op/cache';
import {
  NotFoundError,
  UnauthorizedError,
  getPermissionsOnProposal,
  getProposal,
} from '@op/common';
import { logger } from '@op/logging';
import { TRPCError } from '@trpc/server';
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

      try {
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

        // Extract decision profile slug for navigation
        const decisionSlug =
          proposal.processInstance &&
          typeof proposal.processInstance === 'object' &&
          'profile' in proposal.processInstance &&
          proposal.processInstance.profile &&
          typeof proposal.processInstance.profile === 'object' &&
          'slug' in proposal.processInstance.profile
            ? (proposal.processInstance.profile.slug as string)
            : undefined;

        return proposalEncoder.parse({
          ...proposal,
          decisionSlug,
        });
      } catch (error: unknown) {
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: error.message,
            code: 'UNAUTHORIZED',
          });
        }

        if (error instanceof NotFoundError) {
          throw new TRPCError({
            message: error.message,
            code: 'NOT_FOUND',
          });
        }

        logger.error('Error fetching proposal', {
          error,
          profileId,
        });
        throw new TRPCError({
          message: 'Failed to fetch proposal',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
