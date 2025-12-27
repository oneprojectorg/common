import { listDecisionProfiles } from '@op/common';
import type { OpenApiMeta } from 'trpc-to-openapi';

import {
  legacyDecisionProfileFilterSchema,
  legacyDecisionProfileListEncoder,
} from '../../../encoders/legacyDecision';
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
    summary: 'List decision profiles with their process instances',
  },
};

export const listDecisionProfilesRouter = router({
  listDecisionProfiles: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(legacyDecisionProfileFilterSchema)
    .output(legacyDecisionProfileListEncoder)
    .query(async ({ input, ctx }) => {
      const { user } = ctx;

      const result = await listDecisionProfiles({
        ...input,
        user,
      });

      return legacyDecisionProfileListEncoder.parse(result);
    }),
});
