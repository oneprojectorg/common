import { updateDecisionRoles } from '@op/common';
import { z } from 'zod';

import { decisionRoleEncoder } from '../../encoders/access';
import { commonAuthedProcedure, router } from '../../trpcFactory';

export const updateDecisionRolesRouter = router({
  updateDecisionRoles: commonAuthedProcedure()
    .input(
      z.object({
        roleId: z.string().uuid(),
        decisionPermissions: decisionRoleEncoder,
      }),
    )
    .output(
      z.object({
        roleId: z.string(),
        decisionPermissions: decisionRoleEncoder,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return updateDecisionRoles({
        roleId: input.roleId,
        decisionPermissions: input.decisionPermissions,
        user: ctx.user,
      });
    }),
});
