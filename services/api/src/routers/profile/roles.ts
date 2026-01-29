import { getRoles } from '@op/common';
import { z } from 'zod';

import { roleEncoder } from '../../encoders/roles';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import {
  createPaginatedOutput,
  createSortable,
  paginationSchema,
} from '../../utils';

const roleSortableSchema = createSortable(['name'] as const);

const inputSchema = z
  .object({
    slug: z.string().optional(),
  })
  .merge(paginationSchema)
  .merge(roleSortableSchema);

export const rolesRouter = router({
  listRoles: commonAuthedProcedure()
    .input(inputSchema)
    .output(createPaginatedOutput(roleEncoder))
    .query(async ({ input }) => {
      const { slug, cursor, limit, dir } = input;

      return getRoles({
        profileSlug: slug,
        cursor,
        limit,
        dir,
      });
    }),
});
