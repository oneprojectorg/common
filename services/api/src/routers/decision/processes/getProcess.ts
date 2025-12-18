import { NotFoundError, getProcess } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { decisionProcessEncoder } from '../../../encoders/legacyDecision';
import { loggedProcedure, router } from '../../../trpcFactory';

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

export const getProcessRouter = router({
  getProcess: loggedProcedure
    .meta(meta)
    .input(z.object({ id: z.uuid() }))
    .output(decisionProcessEncoder)
    .query(async ({ input }) => {
      try {
        const process = await getProcess(input.id);
        return decisionProcessEncoder.parse(process);
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
