import { taxonomies, taxonomyTerms } from '@op/db/schema';
import { eq, sql } from 'drizzle-orm';
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
    .query(async ({ input, ctx }) => {
      const { name, q } = input;
      const { db } = ctx.database;

      let whereClause = eq(taxonomies.name, name);
      if (q) {
        whereClause = sql`${taxonomies.name} = ${name} AND ${taxonomyTerms.label} @@ plainto_tsquery('english', ${q})`;
      }

      const results = await db
        .select()
        .from(taxonomyTerms)
        .innerJoin(taxonomies, () =>
          eq(taxonomyTerms.taxonomyId, taxonomies.id),
        )
        .where(whereClause);

      const terms = results.map((row) => row.taxonomyTerms);
      console.log('TERMS', terms);
      return terms;
    }),
});
