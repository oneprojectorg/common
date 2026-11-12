import {
  categoryDevelopmentChangeSchema,
  categoryDevelopmentTargetSchema,
  unconfirmCategoryDevelopment,
} from '@op/common';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const unconfirmCategoryDevelopmentRouter = router({
  unconfirmCategoryDevelopment: networkAuthenticatedProcedure()
    .input(categoryDevelopmentTargetSchema)
    .output(categoryDevelopmentChangeSchema)
    .mutation(async ({ ctx, input }) => {
      return await unconfirmCategoryDevelopment({
        processInstanceId: input.processInstanceId,
        taxonomyTermId: input.taxonomyTermId,
        user: ctx.user,
      });
    }),
});
