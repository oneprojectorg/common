import { updateRolePermissions } from '@op/common';
import { z } from 'zod';

import {
  accessRoleMinimalEncoder,
  permissionsSchema,
} from '../../encoders/access';
import { commonAuthedProcedure, router } from '../../trpcFactory';

const DECISIONS_ZONE_NAME = 'decisions';

export const updateRolePermissionRouter = router({
  updateRolePermission: commonAuthedProcedure()
    .input(
      z.object({
        roleId: z.string().uuid(),
        permissions: permissionsSchema,
      }),
    )
    .output(accessRoleMinimalEncoder)
    .mutation(async ({ ctx, input }) => {
      return updateRolePermissions({
        roleId: input.roleId,
        zoneName: DECISIONS_ZONE_NAME,
        permissions: input.permissions,
        user: ctx.user,
      });
    }),
});
