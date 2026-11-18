import { confirmCategoryDevelopment } from '@op/common';
import {
  categoryDevelopmentChangeSchema,
  categoryDevelopmentTargetSchema,
} from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const confirmCategoryDevelopmentRouter = router({
  confirmCategoryDevelopment: networkAuthenticatedProcedure()
    .input(categoryDevelopmentTargetSchema)
    .output(categoryDevelopmentChangeSchema)
    .mutation(async ({ ctx, input }) => {
      return await confirmCategoryDevelopment({
        processInstanceId: input.processInstanceId,
        taxonomyTermId: input.taxonomyTermId,
        reviewerProfileId: input.reviewerProfileId,
        user: ctx.user,
      });
    }),
});
