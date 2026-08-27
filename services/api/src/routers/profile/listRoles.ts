import { getRoles } from '@op/common';
import { z } from 'zod';

import { roleEncoder } from '../../encoders/roles';
import { networkAuthenticatedProcedure, router } from '../../trpcFactory';
import {
  createPaginatedOutput,
  createSortable,
  paginationSchema,
} from '../../utils';

const roleSortableSchema = createSortable(['name'] as const);

const inputSchema = z
  .object({
    profileId: z.string().uuid().optional(),
    zoneName: z.string().optional(),
    includeMemberCounts: z.boolean().optional(),
  })
  .merge(paginationSchema)
  .merge(roleSortableSchema);

export const listRolesRouter = router({
  listRoles: networkAuthenticatedProcedure()
    .input(inputSchema)
    .output(createPaginatedOutput(roleEncoder))
    .query(async ({ input }) => {
      const { profileId, zoneName, includeMemberCounts, cursor, limit, dir } =
        input;

      return getRoles({
        profileId,
        zoneName,
        includeMemberCounts,
        cursor,
        limit,
        dir,
      });
    }),
});
