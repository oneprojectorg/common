import { deleteRole } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

export const deleteRoleRouter = router({
  deleteRole: commonAuthedProcedure()
    .input(z.object({ roleId: z.string().uuid() }))
    .output(z.object({ deletedId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return deleteRole({
        roleId: input.roleId,
        user: ctx.user,
      });
    }),
});
