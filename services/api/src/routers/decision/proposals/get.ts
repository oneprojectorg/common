import { trackProposalViewed } from '../../../utils/analytics';
import { cache } from '@op/cache';
import { NotFoundError, UnauthorizedError, getProposal } from '@op/common';
import { TRPCError } from '@trpc/server';
import { waitUntil } from '@vercel/functions';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { proposalEncoder } from '../../../encoders/decision';
import withAnalytics from '../../../middlewares/withAnalytics';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import { loggedProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/decision/proposal/{profileId}',
    protect: true,
    tags: ['decision'],
    summary: 'Get proposal details',
  },
};

export const getProposalRouter = router({
  getProposal: loggedProcedure
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(
      z.object({
        profileId: z.string().uuid(),
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

        // Track proposal viewed event
        if (
          proposal.processInstance &&
          typeof proposal.processInstance === 'object' &&
          !Array.isArray(proposal.processInstance) &&
          'id' in proposal.processInstance
        ) {
          waitUntil(
            trackProposalViewed(
              ctx,
              proposal.processInstance.id,
              proposal.id,
            ),
          );
        }

        return proposalEncoder.parse(proposal);
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

        throw new TRPCError({
          message: 'Failed to fetch proposal',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
