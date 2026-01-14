import { NotFoundError, getProcess } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { legacyDecisionProcessEncoder } from '../../../encoders/legacyDecision';
import { commonProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/decision/process/{id}',
    protect: true,
    tags: ['decision'],
    summary: 'Get decision process by ID',
  },
};

/** @deprecated Use the new decision system instead */
export const getProcessRouter = router({
  getProcess: commonProcedure
    .meta(meta)
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
