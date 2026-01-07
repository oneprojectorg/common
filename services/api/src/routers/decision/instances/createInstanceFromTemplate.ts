import { CommonError, createInstanceFromTemplate } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';

import {
  createInstanceFromTemplateInputSchema,
  processInstanceEncoder,
} from '../../../encoders/decision';
import withAnalytics from '../../../middlewares/withAnalytics';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: '/decision/instance/from-template',
    protect: true,
    tags: ['decision'],
    summary: 'Create process instance from a DecisionSchemaDefinition template',
  },
};

export const createInstanceFromTemplateRouter = router({
  createInstanceFromTemplate: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(createInstanceFromTemplateInputSchema)
    .output(processInstanceEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      try {
        const instance = await createInstanceFromTemplate({
          ...input,
          user,
        });

        return processInstanceEncoder.parse(instance);
      } catch (error: unknown) {
        if (error instanceof CommonError) {
          throw error;
        }

        throw new TRPCError({
          message: 'Failed to create process instance',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
