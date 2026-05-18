import { updateDecisionRoles } from '@op/common';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { decisionRoleEncoder } from '../../encoders/access';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { trackAdminGaveRoles } from '../../utils/analytics';

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
      const result = await updateDecisionRoles({
        roleId: input.roleId,
        decisionPermissions: input.decisionPermissions,
        user: ctx.user,
      });

      waitUntil(
        trackAdminGaveRoles(ctx, input.roleId, {
          decision_permissions: input.decisionPermissions,
        }),
      );

      return result;
    }),
});
