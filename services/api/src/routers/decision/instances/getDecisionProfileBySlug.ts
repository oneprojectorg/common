import { z } from 'zod';
import type { OpenApiMeta } from 'trpc-to-openapi';

import { decisionProfileEncoder } from '../../../encoders/decision';
import withAnalytics from '../../../middlewares/withAnalytics';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';
import { getDecisionProfileBySlug } from '@op/common';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/decision/profile/{slug}',
    summary: 'Get a decision profile by slug',
    tags: ['Decision'],
  },
};

const inputSchema = z.object({
  slug: z.string(),
});

export const getDecisionProfileBySlugRouter = router({
  getDecisionProfileBySlug: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 20 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(inputSchema)
    .output(decisionProfileEncoder.nullable())
    .query(async ({ input, ctx }) => {
      const { user } = ctx;
      const { slug } = input;

      const result = await getDecisionProfileBySlug({
        slug,
        user,
      });

      if (!result) {
        return null;
      }

      return decisionProfileEncoder.parse(result);
    }),
});
