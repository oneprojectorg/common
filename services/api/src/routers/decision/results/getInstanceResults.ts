import { NotFoundError, getLatestResultWithProposals } from '@op/common';
import { PAGE_LIMIT } from '@op/common/client';

import { legacyInstanceResultsEncoder } from '../../../encoders/legacyDecision';
import { getInstanceResultsInputSchema } from '../../../encoders/results';
import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const getInstanceResultsRouter = router({
  getInstanceResults: networkAuthenticatedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 30 },
  })
    .input(getInstanceResultsInputSchema)
    .output(legacyInstanceResultsEncoder)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { limit = PAGE_LIMIT.md, cursor } = input ?? {};

      const result = await getLatestResultWithProposals({
        processInstanceId: input?.instanceId ?? '',
        user,
        limit,
        cursor,
      });

      if (!result) {
        throw new NotFoundError('Results', input?.instanceId);
      }

      return result;
    }),
});
