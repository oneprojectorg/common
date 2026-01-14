import { getTerms } from '@op/common';
import { z } from 'zod';

import { taxonomyTermsWithChildrenEncoder } from '../../encoders/taxonomyTerms';
import { commonAuthedProcedure, router } from '../../trpcFactory';

export const termsRouter = router({
  getTerms: commonAuthedProcedure()
    .input(z.object({ name: z.string().min(3), q: z.string().optional() }))
    .output(z.array(taxonomyTermsWithChildrenEncoder))
    .query(async ({ input }) => {
      const { name, q } = input;

      const terms = await getTerms({ name, query: q });

      return terms.map((term) => taxonomyTermsWithChildrenEncoder.parse(term));
    }),
});
