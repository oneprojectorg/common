import { updateRole } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

export const updateRoleRouter = router({
  updateRole: commonAuthedProcedure()
    .input(
      z.object({
        roleId: z.string().uuid(),
        name: z.string().min(1).max(255),
      }),
    )
    .output(z.object({ id: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return updateRole({
        roleId: input.roleId,
        name: input.name,
        user: ctx.user,
      });
    }),
});
