import { cache } from '@op/cache';
import { searchOrganizations } from '@op/common';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { organizationsEncoder } from '../../encoders/organizations';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';

export const searchOrganizationsRouter = router({
  search: commonAuthedProcedure()
    .input(
      dbFilter.extend({
        q: z.string(),
      }),
    )
    .output(z.array(organizationsEncoder))
    .query(async ({ ctx, input }) => {
      const { q, limit = 10 } = input;

      const result = await cache<ReturnType<typeof searchOrganizations>>({
        type: 'search',
        params: [q, ctx.user.id],
        options: {
          ttl: 30 * 1000,
        },
        fetch: () =>
          searchOrganizations({
            query: q,
            limit,
          }),
      });

      if (!result) {
        throw new TRPCError({
          message: 'Organizations not found',
          code: 'NOT_FOUND',
        });
      }

      return result.map((org) => {
        // TODO: Doing this to account for the difference in shape between on avatarImage
        // which here is rendered even if it is null (with all null values)
        // @ts-expect-error
        if (org.profile.avatarImage.id == null) {
          // @ts-expect-error
          org.profile.avatarImage = null;
        }
        return organizationsEncoder.parse(org);
      });
    }),
});
