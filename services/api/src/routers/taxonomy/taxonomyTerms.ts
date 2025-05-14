import { getTerms } from '@op/common';
import { z } from 'zod';

import { taxonomyTermsEncoder } from '../../encoders/taxonomyTerms';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

export const termsRouter = router({
  getTerms: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    .input(z.object({ name: z.string().min(3), q: z.string().optional() }))
    .output(z.array(taxonomyTermsEncoder))
    .query(async ({ input }) => {
      const { name, q } = input;

      const terms = await getTerms({ name, query: q });

      return terms.map((term) => taxonomyTermsEncoder.parse(term));
    }),
});
