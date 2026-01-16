import { getDecisionBySlug } from '@op/common';
import { z } from 'zod';

import { decisionProfileWithSchemaEncoder } from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

const inputSchema = z.object({
  slug: z.string().min(1, 'Slug cannot be empty'),
});

export const getDecisionBySlugRouter = router({
  getDecisionBySlug: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .input(inputSchema)
    .output(decisionProfileWithSchemaEncoder)
    .query(async ({ input, ctx }) => {
      const { user } = ctx;
      const { slug } = input;

      const result = await getDecisionBySlug({
        slug,
        user,
      });

      return decisionProfileWithSchemaEncoder.parse(result);
    }),
});
