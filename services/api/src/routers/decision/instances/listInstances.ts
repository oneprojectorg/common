import { listInstances } from '@op/common';
import type { OpenApiMeta } from 'trpc-to-openapi';

import {
  legacyInstanceFilterSchema,
  legacyProcessInstanceListEncoder,
} from '../../../encoders/legacyDecision';
import withAnalytics from '../../../middlewares/withAnalytics';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/decision/instances',
    protect: true,
    tags: ['decision'],
    summary: 'List process instances',
  },
};

export const listInstancesRouter = router({
  listInstances: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(legacyInstanceFilterSchema)
    .output(legacyProcessInstanceListEncoder)
    .query(async ({ input, ctx }) => {
      const { user } = ctx;

      const result = await listInstances({
        ...input,
        user,
        authUserId: ctx.user.id,
      });

      return legacyProcessInstanceListEncoder.parse({
        instances: result.instances.map((instance) => ({
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
        })),
        total: result.total,
        hasMore: result.hasMore,
      });
    }),
});
