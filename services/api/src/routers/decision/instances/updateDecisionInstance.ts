import { updateDecisionInstance } from '@op/common';
import type { OpenApiMeta } from 'trpc-to-openapi';

import {
  decisionProfileEncoder,
  updateDecisionInstanceInputSchema,
} from '../../../encoders/decision';
import withAnalytics from '../../../middlewares/withAnalytics';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'PATCH',
    path: '/decision/instance/{instanceId}',
    protect: true,
    tags: ['decision'],
    summary: 'Update a decision process instance',
  },
};

export const updateDecisionInstanceRouter = router({
  updateDecisionInstance: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(updateDecisionInstanceInputSchema)
    .output(decisionProfileEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const profile = await updateDecisionInstance({
        ...input,
        user,
      });

      return decisionProfileEncoder.parse(profile);
    }),
});
