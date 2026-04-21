import { invalidate } from '@op/cache';
import { updateOrganization } from '@op/common';
import { waitUntil } from '@vercel/functions';

import { organizationsEncoder } from '../../encoders/organizations';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { trackFundingToggle } from '../../utils/analytics';
import { updateOrganizationInputSchema } from './validators';

export const updateOrganizationRouter = router({
  update: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .input(updateOrganizationInputSchema)
    .output(organizationsEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

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
    }),
});
