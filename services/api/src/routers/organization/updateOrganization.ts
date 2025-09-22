import { trackFundingToggle } from '../../utils/analytics';
import { invalidate } from '@op/cache';
import { UnauthorizedError, updateOrganization } from '@op/common';
import { TRPCError } from '@trpc/server';
import { waitUntil } from '@vercel/functions';
import type { OpenApiMeta } from 'trpc-to-openapi';

import { organizationsEncoder } from '../../encoders/organizations';
import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';
import { updateOrganizationInputSchema } from './validators';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'PUT',
    path: '/organization/{id}',
    protect: true,
    tags: ['organization'],
    summary: 'Update organization',
  },
};

export const updateOrganizationRouter = router({
  update: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 20 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    // Router
    .meta(meta)
    .input(updateOrganizationInputSchema)
    .output(organizationsEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      try {
        const org = await updateOrganization({
          id: input.id,
          data: input,
          user,
        });

        // Track funding toggle analytics if funding status changed (non-blocking)
        if (
          input.isOfferingFunds !== undefined ||
          input.isReceivingFunds !== undefined
        ) {
          if (user) {
            waitUntil(
              trackFundingToggle(
                { organizationId: input.id },
                {
                  isOfferingFunds: input.isOfferingFunds,
                  isReceivingFunds: input.isReceivingFunds,
                },
              ),
            );
          }
        }

        // invalidate cache and wait for a return so FE can then refetch
        await Promise.all([
          invalidate({ type: 'organization', params: [org.profile.slug] }),
          invalidate({ type: 'organization', params: [org.id] }),
        ]);

        return organizationsEncoder.parse(org);
      } catch (error: unknown) {
        console.log('ERROR', error);

        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: 'You do not have permission to update this organization',
            code: 'UNAUTHORIZED',
          });
        }

        throw new TRPCError({
          message: 'Failed to update organization',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
