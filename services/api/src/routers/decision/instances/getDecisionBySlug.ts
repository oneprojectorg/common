import { getDecisionBySlug } from '@op/common';
import { z } from 'zod';

import { decisionProfileEncoder } from '../../../encoders/decision';
import withAnalytics from '../../../middlewares/withAnalytics';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';

const inputSchema = z.object({
  slug: z.string().min(1, "Slug cannot be empty"),
});

export const getDecisionBySlugRouter = router({
  getDecisionBySlug: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 20 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .input(inputSchema)
    .output(decisionProfileEncoder)
    .query(async ({ input, ctx }) => {
      const { user } = ctx;
      const { slug } = input;

      const result = await getDecisionBySlug({
        slug,
        user,
      });

      return decisionProfileEncoder.parse(result);
    }),
});
