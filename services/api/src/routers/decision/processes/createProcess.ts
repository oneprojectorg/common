import { createProcess } from '@op/common';

import {
  legacyCreateProcessInputSchema,
  legacyDecisionProcessEncoder,
} from '../../../encoders/legacyDecision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

/** @deprecated Use the new decision system instead */
export const createProcessRouter = router({
  createProcess: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 5 },
  })
    .input(legacyCreateProcessInputSchema)
    .output(legacyDecisionProcessEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      const process = await createProcess({ data: input, user });

      logger.info('Decision process created', {
        userId: user.id,
        processId: process.id,
        processName: process.name,
      });

      return legacyDecisionProcessEncoder.parse(process);
    }),
});
