import { getTerms } from '@op/common';
import { z } from 'zod';

import { taxonomyTermsWithChildrenEncoder } from '../../encoders/taxonomyTerms';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

export const termsRouter = router({
  getTerms: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .input(z.object({ name: z.string().min(3), q: z.string().optional() }))
    .output(z.array(taxonomyTermsWithChildrenEncoder))
    .query(async ({ input }) => {
      const { name, q } = input;

      const terms = await getTerms({ name, query: q });

      return terms.map((term) => taxonomyTermsWithChildrenEncoder.parse(term));
    }),
});
