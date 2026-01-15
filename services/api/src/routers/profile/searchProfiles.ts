import { cache } from '@op/cache';
import { searchProfiles } from '@op/common';
import { EntityType } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { searchProfilesResultEncoder } from '../../encoders/searchResults';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';

export const searchProfilesRouter = router({
  search: commonAuthedProcedure()
    .input(
      dbFilter.extend({
        q: z.string(),
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
        throw new TRPCError({
          message: 'Profiles not found',
          code: 'NOT_FOUND',
        });
      }

      return result;
    }),
});
