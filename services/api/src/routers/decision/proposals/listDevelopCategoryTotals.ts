import { Channels, listDevelopCategoryTotals } from '@op/common';
import {
  developCategoryTotalsListSchema,
  listDevelopCategoryTotalsInputSchema,
} from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listDevelopCategoryTotalsRouter = router({
  /**
   * Every category of the instance with its origins and ready entries in the
   * current develop phase, counted in the database. Admin only.
   */
  listDevelopCategoryTotals: networkAuthenticatedProcedure()
    .input(listDevelopCategoryTotalsInputSchema)
    .output(developCategoryTotalsListSchema)
    .query(async ({ ctx, input }) => {
      const items = await listDevelopCategoryTotals({ input, user: ctx.user });

      // Create and submit of a developed proposal register this channel.
      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return { items };
    }),
});
