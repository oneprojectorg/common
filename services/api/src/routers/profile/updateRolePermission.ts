import { updateRolePermissions } from '@op/common';
import { accessRoleMinimalSchema } from '@op/common/client';
import { z } from 'zod';

import { permissionsSchema } from '../../encoders/access';
import { commonNetworkProcedure, router } from '../../trpcFactory';

const DECISIONS_ZONE_NAME = 'decisions';

export const updateRolePermissionRouter = router({
  updateRolePermission: commonNetworkProcedure()
    .input(
      z.object({
        roleId: z.string().uuid(),
        permissions: permissionsSchema,
      }),
    )
    .output(accessRoleMinimalSchema)
    .mutation(async ({ ctx, input }) => {
      return updateRolePermissions({
        roleId: input.roleId,
        zoneName: DECISIONS_ZONE_NAME,
        permissions: input.permissions,
        user: ctx.user,
      });
    }),
});
