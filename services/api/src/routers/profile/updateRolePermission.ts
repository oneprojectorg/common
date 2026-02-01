import { updateRolePermissions } from '@op/common';
import { toBitField } from 'access-zones';
import { z } from 'zod';

import { permissionsSchema } from '../../encoders/access';
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
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const bitfield = toBitField(input.permissions);
      return updateRolePermissions({
        roleId: input.roleId,
        zoneName: DECISIONS_ZONE_NAME,
        permission: bitfield,
        user: ctx.user,
      });
    }),
});
