import { updateDecisionRoles } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';
import { decisionRoleSchema } from './decisionRoleSchema';

export const updateDecisionRolesRouter = router({
  updateDecisionRoles: commonAuthedProcedure()
    .input(
      z.object({
        roleId: z.string().uuid(),
        decisionPermissions: decisionRoleSchema,
      }),
    )
    .output(
      z.object({
        roleId: z.string(),
        decisionPermissions: decisionRoleSchema,
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
