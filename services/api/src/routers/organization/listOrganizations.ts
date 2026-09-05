import { listOrganizations } from '@op/common';
import { PAGE_LIMIT } from '@op/common/client';
import { z } from 'zod';

import { organizationsWithProfileEncoder } from '../../encoders/organizations';
import { networkAuthenticatedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';

export const listOrganizationsRouter = router({
  list: networkAuthenticatedProcedure()
    .input(
      dbFilter
        .extend({
          terms: z.array(z.string()).nullish(),
          orderBy: z.enum(['createdAt', 'updatedAt']).optional(),
        })
        .optional(),
    )
    .output(
      z.object({
        items: z.array(organizationsWithProfileEncoder),
        next: z.string().nullish(),
      }),
    )
    .query(async ({ input }) => {
      const { limit = PAGE_LIMIT.sm, cursor, orderBy, dir } = input ?? {};

      const { items, next } = await listOrganizations({
        cursor,
        limit,
        orderBy,
        dir,
      });

      return {
        items: items.map((org) => organizationsWithProfileEncoder.parse(org)),
        next,
      };
    }),
});
