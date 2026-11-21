import { Channels, confirmCategoryDevelopment } from '@op/common';
import {
  categoryDevelopmentChangeSchema,
  categoryDevelopmentTargetSchema,
} from '@op/common/client';
import { waitUntil } from '@vercel/functions';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';
import { trackDevelopCategoryConfirmed } from '../../../utils/analytics';

export const confirmCategoryDevelopmentRouter = router({
  confirmCategoryDevelopment: networkAuthenticatedProcedure()
    .input(categoryDevelopmentTargetSchema)
    .output(categoryDevelopmentChangeSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await confirmCategoryDevelopment({
        processInstanceId: input.processInstanceId,
        taxonomyTermId: input.taxonomyTermId,
        reviewerProfileId: input.reviewerProfileId,
        user: ctx.user,
      });

      // A confirm changes which entries the reviewer may still edit.
      ctx.registerMutationChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      waitUntil(
        trackDevelopCategoryConfirmed(ctx, input.processInstanceId, {
          taxonomy_term_id: input.taxonomyTermId ?? null,
          reviewer_profile_ids: result.reviewers.map(
            (reviewer) => reviewer.reviewerProfileId,
          ),
          confirmed_reviewer_count: result.reviewers.length,
          process_owner_profile_id: result.processOwnerProfileId,
        }),
      );

      return result;
    }),
});
