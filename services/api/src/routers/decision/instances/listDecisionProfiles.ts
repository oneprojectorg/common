import { listDecisionProfiles } from '@op/common';
import type { OpenApiMeta } from 'trpc-to-openapi';

import {
  decisionProfileFilterSchema,
  decisionProfileListEncoder,
} from '../../../encoders/decision';
import withAnalytics from '../../../middlewares/withAnalytics';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/decision/profiles',
    protect: true,
    tags: ['decision'],
    summary: 'List decision profiles',
  },
};

export const listDecisionProfilesRouter = router({
  listDecisionProfiles: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(decisionProfileFilterSchema)
    .output(decisionProfileListEncoder)
    .query(async ({ input, ctx }) => {
      const { user } = ctx;

      const result = await listDecisionProfiles({
        ...input,
        user,
      });

      return decisionProfileListEncoder.parse({
        items: result.items.map((profile) => {
          const processInstance = profile.processInstance as any;
          return {
            ...profile,
            processInstance: processInstance
              ? {
                  ...processInstance,
                  instanceData: processInstance.instanceData as Record<
                    string,
                    any
                  >,
                  process: processInstance.process
                    ? {
                        ...processInstance.process,
                        processSchema: (() => {
                          const schema = processInstance.process?.processSchema;
                          return typeof schema === 'object' &&
                            schema !== null &&
                            !Array.isArray(schema)
                            ? schema
                            : {};
                        })(),
                      }
                    : undefined,
                }
              : undefined,
          };
        }),
        next: result.next,
        hasMore: result.hasMore,
      });
    }),
});
