import { listInstances } from '@op/common';
import type { OpenApiMeta } from 'trpc-to-openapi';

import {
  instanceFilterSchema,
  processInstanceListEncoder,
} from '../../../encoders/decision';
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
    .meta(meta)
    .input(instanceFilterSchema)
    .output(processInstanceListEncoder)
    .query(async ({ input, ctx }) => {
      const result = await listInstances({ ...input, user: ctx.user });

      return processInstanceListEncoder.parse({
        instances: result.instances.map((instance) => ({
          ...instance,
          instanceData: instance.instanceData as Record<string, any>,
          process: instance.process
            ? {
                ...instance.process,
                processSchema: instance.process.processSchema as Record<
                  string,
                  any
                >,
              }
            : undefined,
        })),
        total: result.total,
        hasMore: result.hasMore,
      });
    }),
});
