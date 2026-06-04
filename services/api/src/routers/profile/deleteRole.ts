import { deleteRole } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

export const deleteRoleRouter = router({
  deleteRole: networkAuthenticatedProcedure()
    .input(z.object({ roleId: z.string().uuid() }))
    .output(z.object({ deletedId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return deleteRole({
        roleId: input.roleId,
        user: ctx.user,
      });
    }),
});
