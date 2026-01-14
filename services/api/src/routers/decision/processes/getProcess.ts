import { NotFoundError, getProcess } from '@op/common';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { legacyDecisionProcessEncoder } from '../../../encoders/legacyDecision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

/** @deprecated Use the new decision system instead */
export const getProcessRouter = router({
  getProcess: commonAuthedProcedure()
    .input(z.object({ id: z.uuid() }))
    .output(legacyDecisionProcessEncoder)
    .query(async ({ input }) => {
      try {
        const process = await getProcess(input.id);
        return legacyDecisionProcessEncoder.parse(process);
      } catch (error: unknown) {
        if (error instanceof NotFoundError) {
          throw new TRPCError({
            message: 'Decision process not found',
            code: 'NOT_FOUND',
          });
        }

        throw new TRPCError({
          message: 'Failed to fetch decision process',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
