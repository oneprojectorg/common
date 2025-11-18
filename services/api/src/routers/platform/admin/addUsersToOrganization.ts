import { invalidate } from '@op/cache';
import { db } from '@op/db/client';
import {
  organizationUserToAccessRoles,
  organizationUsers,
} from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';

/**
 * Input validation schema for adding users to an organization
 *
 * Supports:
 * - Adding multiple users at once (batch operation)
 * - Existing users via authUserId
 * - Role assignment for each user
 */
const inputSchema = z.object({
  organizationId: z.string(),
  users: z
    .array(
      z.object({
        authUserId: z.string(),
        roleIds: z.array(z.string()).min(1, 'At least one role is required'),
      }),
    )
    .min(1, 'At least one user is required'),
});

/**
 * Output schema for the add users operation
 *
 * Returns array of successfully added users with their organization user IDs.
 * Any failures will throw a TRPCError instead of being returned in the response.
 */
const outputSchema = z.array(
  z.object({
    authUserId: z.string(),
    organizationUserId: z.string(),
  }),
);

export const addUsersToOrganizationRouter = router({
  addUsersToOrganization: loggedProcedure
    .use(withRateLimited({ windowSize: 60, maxRequests: 20 }))
    .use(withAuthenticatedPlatformAdmin)
    .input(inputSchema)
    .output(outputSchema)
    .mutation(async ({ input }) => {
      const { organizationId, users: usersToAdd } = input;

      try {
        // Collect all unique IDs from the input
        const allRoleIds = Array.from(
          new Set(usersToAdd.flatMap((user) => user.roleIds)),
        );
        const allAuthUserIds = usersToAdd.map((user) => user.authUserId);

        // Validate all entities exist
        const [organization, existingRoles, existingUsers] = await Promise.all([
          // Validate organization exists
          db.query.organizations.findFirst({
            where: (table, { eq }) => eq(table.id, organizationId),
            columns: { id: true },
          }),
          // Validate all role IDs exist
          db.query.accessRoles.findMany({
            where: (table, { inArray }) => inArray(table.id, allRoleIds),
            columns: { id: true },
          }),
          // Validate all users exist and get their details
          // TODO: do we need both auth.users and users? or do we have type guarantees?
          db.query.users.findMany({
            where: (table, { inArray }) =>
              inArray(table.authUserId, allAuthUserIds),
            columns: { authUserId: true, email: true, name: true },
          }),
        ]);

        // Check organization exists
        if (!organization) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Organization with ID ${organizationId} does not exist`,
          });
        }

        // Check all role IDs exist
        const existingRoleIds = new Set(existingRoles.map((role) => role.id));
        const invalidRoleIds = allRoleIds.filter(
          (roleId) => !existingRoleIds.has(roleId),
        );

        if (invalidRoleIds.length > 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Invalid role ID(s): ${invalidRoleIds.join(', ')}`,
          });
        }

        // Check all users exist
        const existingUserIds = new Set(
          existingUsers.map((user) => user.authUserId),
        );
        const invalidUserIds = allAuthUserIds.filter(
          (authUserId) => !existingUserIds.has(authUserId),
        );

        if (invalidUserIds.length > 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `User(s) not found: ${invalidUserIds.join(', ')}`,
          });
        }

        // Check if any users are already in the organization
        const existingMemberships = await db.query.organizationUsers.findMany({
          where: (table, { and, eq, inArray }) =>
            and(
              inArray(table.authUserId, allAuthUserIds),
              eq(table.organizationId, organizationId),
            ),
          columns: { authUserId: true },
        });

        if (existingMemberships.length > 0) {
          const existingUserIds = existingMemberships.map(
            (membership) => membership.authUserId,
          );
          throw new TRPCError({
            code: 'CONFLICT',
            message: `User(s) already in organization: ${existingUserIds.join(', ')}`,
          });
        }

        // Use database transaction for atomicity
        const result = await db.transaction(async (tx) => {
          const addedUsers: Array<{
            authUserId: string;
            organizationUserId: string;
          }> = [];

          for (const userToAdd of usersToAdd) {
            // Get the user's email and name from the users table
            const userDetails = existingUsers.find(
              (u) => u.authUserId === userToAdd.authUserId,
            );

            if (!userDetails) {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Failed to find user details for ${userToAdd.authUserId}`,
              });
            }

            // Create organizationUser record
            const [newOrgUser] = await tx
              .insert(organizationUsers)
              .values({
                organizationId,
                authUserId: userToAdd.authUserId,
                email: userDetails.email || '',
                name:
                  userDetails.name ||
                  userDetails.email?.split('@')[0] ||
                  'Unknown',
              })
              .returning({ id: organizationUsers.id });

            if (!newOrgUser) {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Failed to create organization user for ${userToAdd.authUserId}`,
              });
            }

            // Assign roles to the user
            await tx.insert(organizationUserToAccessRoles).values(
              userToAdd.roleIds.map((roleId) => ({
                organizationUserId: newOrgUser.id,
                accessRoleId: roleId,
              })),
            );

            addedUsers.push({
              authUserId: userToAdd.authUserId,
              organizationUserId: newOrgUser.id,
            });
          }

          return addedUsers;
        });

        // Invalidate relevant caches for each added user
        await Promise.all(
          result.map((addedUser) =>
            invalidate({
              type: 'orgUser',
              params: [organizationId, addedUser.authUserId],
            }),
          ),
        );

        return result;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Failed to add users to organization';

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),
});
