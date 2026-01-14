import { NotFoundError, UnauthorizedError, getInstance } from '@op/common';
import { TRPCError } from '@trpc/server';
import { waitUntil } from '@vercel/functions';
import type { OpenApiMeta } from 'trpc-to-openapi';

import {
  legacyGetInstanceInputSchema,
  legacyProcessInstanceEncoder,
} from '../../../encoders/legacyDecision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';
import { trackProcessViewed } from '../../../utils/analytics';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/decision/instance/{instanceId}',
    protect: true,
    tags: ['decision'],
    summary: 'Get process instance by ID',
  },
};

export const getInstanceRouter = router({
  getInstance: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 30 },
  })
    .meta(meta)
    .input(legacyGetInstanceInputSchema)
    .output(legacyProcessInstanceEncoder)
    .query(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        const instance = await getInstance({
          instanceId: input.instanceId,
          authUserId: user.id,
          user,
        });

        // Track process viewed event
        waitUntil(trackProcessViewed(ctx, input.instanceId));

        return legacyProcessInstanceEncoder.parse({
          ...instance,
          instanceData: instance.instanceData as Record<string, any>,
          // Some typechecking since these are unknown
          process: instance.process
            ? {
                ...instance.process,
                processSchema: (() => {
                  const schema = (instance.process as any)?.processSchema;
                  return typeof schema === 'object' &&
                    schema !== null &&
                    !Array.isArray(schema)
                    ? schema
                    : {};
                })(),
              }
            : undefined,
          proposalCount: instance.proposalCount,
          participantCount: instance.participantCount,
        });
      } catch (error) {
        if (error instanceof NotFoundError) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message,
          });
        }

        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: error.message,
          });
        }

        logger.error('Error retrieving process instance', {
          userId: user.id,
          instanceId: input.instanceId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve process instance',
        });
      }
    }),
});
