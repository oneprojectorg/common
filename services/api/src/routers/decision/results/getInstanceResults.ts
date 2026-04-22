import { NotFoundError, getLatestResultWithProposals } from '@op/common';

import { legacyInstanceResultsEncoder } from '../../../encoders/legacyDecision';
import { getInstanceResultsInputSchema } from '../../../encoders/results';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const getInstanceResultsRouter = router({
  getInstanceResults: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 30 },
  })
    .input(getInstanceResultsInputSchema)
    .output(legacyInstanceResultsEncoder)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { limit = 20, cursor } = input ?? {};

      const result = await getLatestResultWithProposals({
        processInstanceId: input?.instanceId ?? '',
        user,
        limit,
        cursor,
      });

      if (!result) {
        throw new NotFoundError(
          'Results',
          input?.instanceId,
          'Results have not been processed yet for this instance',
        );
      }

      return result;
    }),
});
