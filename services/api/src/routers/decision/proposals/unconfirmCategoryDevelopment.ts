import { Channels, unconfirmCategoryDevelopment } from '@op/common';
import {
  categoryDevelopmentChangeSchema,
  categoryDevelopmentTargetSchema,
} from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const unconfirmCategoryDevelopmentRouter = router({
  unconfirmCategoryDevelopment: networkAuthenticatedProcedure()
    .input(categoryDevelopmentTargetSchema)
    .output(categoryDevelopmentChangeSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await unconfirmCategoryDevelopment({
        processInstanceId: input.processInstanceId,
        taxonomyTermId: input.taxonomyTermId,
        reviewerProfileId: input.reviewerProfileId,
        user: ctx.user,
      });

      // An unconfirm changes which entries the reviewer may edit again.
      ctx.registerMutationChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return result;
    }),
});
