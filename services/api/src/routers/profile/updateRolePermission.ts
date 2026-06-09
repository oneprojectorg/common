import { updateRolePermissions } from '@op/common';
import { accessRoleMinimalSchema } from '@op/common/client';
import { z } from 'zod';

import { permissionsSchema } from '../../encoders/access';
import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

const DECISIONS_ZONE_NAME = 'decisions';

export const updateRolePermissionRouter = router({
  updateRolePermission: networkAuthenticatedProcedure()
    .input(
      z.object({
        roleId: z.string().uuid(),
        permissions: permissionsSchema,
        // Required for global roles: the profile whose per-profile override
        // row to write. Optional (and validated) for profile-scoped roles.
        profileId: z.string().uuid().optional(),
      }),
    )
    .output(accessRoleMinimalSchema)
    .mutation(async ({ ctx, input }) => {
      return updateRolePermissions({
        roleId: input.roleId,
        zoneName: DECISIONS_ZONE_NAME,
        permissions: input.permissions,
        user: ctx.user,
        profileId: input.profileId,
      });
    }),
});
