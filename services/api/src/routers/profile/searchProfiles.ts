import { cache } from '@op/cache';
import { NotFoundError, searchProfiles } from '@op/common';
import { EntityType } from '@op/db/schema';
import { z } from 'zod';

import { searchProfilesResultEncoder } from '../../encoders/searchResults';
import { networkAuthenticatedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';

export const searchProfilesRouter = router({
  search: networkAuthenticatedProcedure()
    .input(
      dbFilter.extend({
        // Bounds the tsquery and the cache key; well above the 100 the search
        // input allows, so only a hand-written `?q=` can trip it.
        q: z.string().max(200),
        types: z.array(z.enum(EntityType)).optional(),
      }),
    )
    .output(searchProfilesResultEncoder)
    .query(async ({ ctx, input }) => {
      const { q, limit = 10, types } = input;

      const result = await cache<ReturnType<typeof searchProfiles>>({
        type: 'search',
        params: [q, ctx.user.id, types],
        options: {
          ttl: 30 * 1000,
        },
        fetch: () =>
          searchProfiles({
            query: q,
            limit,
            types,
          }),
      });

      if (!result) {
        throw new NotFoundError('Profiles');
      }

      return result;
    }),
});
