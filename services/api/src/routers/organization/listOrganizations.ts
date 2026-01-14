import { listOrganizations } from '@op/common';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { organizationsWithProfileEncoder } from '../../encoders/organizations';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/organization',
    protect: true,
    tags: ['organization'],
    summary: 'List organizations',
  },
};

export const listOrganizationsRouter = router({
  list: commonAuthedProcedure()
    .meta(meta)
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
        hasMore: z.boolean(),
      }),
    )
    .query(async ({ input }) => {
      const { limit = 10, cursor, orderBy, dir } = input ?? {};

      const { items, next, hasMore } = await listOrganizations({
        cursor,
        limit,
        orderBy,
        dir,
      });

      return {
        items: items.map((org) => organizationsWithProfileEncoder.parse(org)),
        next,
        hasMore,
      };
    }),
});
