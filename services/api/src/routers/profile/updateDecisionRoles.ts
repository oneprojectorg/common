import { updateDecisionRoles } from '@op/common';
import { z } from 'zod';

import { decisionRoleEncoder } from '../../encoders/access';
import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

export const updateDecisionRolesRouter = router({
  updateDecisionRoles: networkAuthenticatedProcedure()
    .input(
      z.object({
        roleId: z.string().uuid(),
        decisionPermissions: decisionRoleEncoder,
        // Required for global roles: the profile whose per-profile override
        // row to write. Optional (and validated) for profile-scoped roles.
        profileId: z.string().uuid().optional(),
      }),
    )
    .output(
      z.object({
        roleId: z.string(),
        decisionPermissions: decisionRoleEncoder,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await updateDecisionRoles({
        roleId: input.roleId,
        decisionPermissions: input.decisionPermissions,
        user: ctx.user,
        profileId: input.profileId,
      });
    }),
});
