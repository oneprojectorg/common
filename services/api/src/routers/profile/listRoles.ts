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
    profileId: z.string().uuid().optional(),
  })
  .merge(paginationSchema)
  .merge(roleSortableSchema);

export const listRolesRouter = router({
  listRoles: commonAuthedProcedure()
    .input(inputSchema)
    .output(createPaginatedOutput(roleEncoder))
    .query(async ({ input }) => {
      const { profileId, cursor, limit, dir } = input;

      return getRoles({
        profileId,
        cursor,
        limit,
        dir,
      });
    }),
});
