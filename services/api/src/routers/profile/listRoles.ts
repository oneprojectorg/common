import {
  createRole,
  deleteRole,
  getRoles,
  getRolesWithPermissions,
  updateRolePermissions,
} from '@op/common';
import { z } from 'zod';

import { roleEncoder, roleWithPermissionsEncoder } from '../../encoders/roles';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import {
  createPaginatedOutput,
  createSortable,
  paginationSchema,
} from '../../utils';

const DECISIONS_ZONE_NAME = 'decisions';

const roleSortableSchema = createSortable(['name'] as const);

const inputSchema = z
  .object({
    profileId: z.string().uuid().optional(),
  })
  .merge(paginationSchema)
  .merge(roleSortableSchema);

export const listRolesRouter = router({
  listRoles: commonAuthedProcedure()
    .input(inputSchema)
    .output(createPaginatedOutput(roleEncoder))
    .query(async ({ input }) => {
      const { profileId, cursor, limit, dir } = input;

      return getRoles({
        profileId,
        cursor,
        limit,
        dir,
      });
    }),

  listRolesWithPermissions: commonAuthedProcedure()
    .input(z.object({ profileId: z.string().uuid() }))
    .output(z.array(roleWithPermissionsEncoder))
    .query(async ({ input }) => {
      return getRolesWithPermissions({
        profileId: input.profileId,
        zoneName: DECISIONS_ZONE_NAME,
      });
    }),

  createRole: commonAuthedProcedure()
    .input(
      z.object({
        profileId: z.string().uuid(),
        name: z.string().min(1).max(255),
        permission: z.number().int().min(0).max(31),
      }),
    )
    .output(roleWithPermissionsEncoder)
    .mutation(async ({ input }) => {
      const role = await createRole(
        input.name,
        { decisions: input.permission },
        undefined,
        input.profileId,
      );

      return {
        id: role.id,
        name: role.name,
        description: role.description,
        isGlobal: false,
        permission: input.permission,
      };
    }),

  updateRolePermission: commonAuthedProcedure()
    .input(
      z.object({
        roleId: z.string().uuid(),
        permission: z.number().int().min(0).max(31),
      }),
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input }) => {
      try {
        return await updateRolePermissions(
          input.roleId,
          DECISIONS_ZONE_NAME,
          input.permission,
        );
      } catch (error) {
        console.error('updateRolePermission error:', error);
        throw error;
      }
    }),

  deleteRole: commonAuthedProcedure()
    .input(z.object({ roleId: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input }) => {
      return deleteRole(input.roleId);
    }),
});
