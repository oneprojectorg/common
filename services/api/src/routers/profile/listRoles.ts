import {
  createRole,
  deleteRole,
  getRoles,
  updateRolePermissions,
} from '@op/common';
import { toBitField } from 'access-zones';
import { z } from 'zod';

import { roleEncoder } from '../../encoders/roles';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import {
  createPaginatedOutput,
  createSortable,
  paginationSchema,
} from '../../utils';

const DECISIONS_ZONE_NAME = 'decisions';

const permissionsInputSchema = z.object({
  admin: z.boolean(),
  create: z.boolean(),
  read: z.boolean(),
  update: z.boolean(),
  delete: z.boolean(),
});

const roleSortableSchema = createSortable(['name'] as const);

const inputSchema = z
  .object({
    profileId: z.string().uuid().optional(),
    zoneName: z.string().optional(),
  })
  .merge(paginationSchema)
  .merge(roleSortableSchema);

export const listRolesRouter = router({
  listRoles: commonAuthedProcedure()
    .input(inputSchema)
    .output(createPaginatedOutput(roleEncoder))
    .query(async ({ input }) => {
      const { profileId, zoneName, cursor, limit, dir } = input;

      return getRoles({
        profileId,
        zoneName,
        cursor,
        limit,
        dir,
      });
    }),

  createRole: commonAuthedProcedure()
    .input(
      z.object({
        profileId: z.string().uuid(),
        name: z.string().min(1).max(255),
        permissions: permissionsInputSchema,
      }),
    )
    .output(roleEncoder.required({ permissions: true }))
    .mutation(async ({ ctx, input }) => {
      const bitfield = toBitField(input.permissions);
      const role = await createRole({
        name: input.name,
        permissions: { decisions: bitfield },
        profileId: input.profileId,
        user: ctx.user,
      });

      return {
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: input.permissions,
      };
    }),

  updateRolePermission: commonAuthedProcedure()
    .input(
      z.object({
        roleId: z.string().uuid(),
        permissions: permissionsInputSchema,
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

  deleteRole: commonAuthedProcedure()
    .input(z.object({ roleId: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return deleteRole({
        roleId: input.roleId,
        user: ctx.user,
      });
    }),
});
