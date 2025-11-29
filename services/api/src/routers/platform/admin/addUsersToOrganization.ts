import { invalidate } from '@op/cache';
import { CommonError, NotFoundError, joinOrganization } from '@op/common';
import { db } from '@op/db/client';
import { Channels } from '@op/realtime';
import { realtime } from '@op/realtime/server';
import { TRPCError } from '@trpc/server';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';

/**
 * Supports:
 * - Adding multiple users at once (batch operation)
 * - Role assignment for each user
 */
const inputSchema = z.object({
  organizationId: z.string(),
  users: z
    .array(
      z.object({
        authUserId: z.string(),
        roleId: z.string(),
      }),
    )
    .min(1, 'At least one user is required'),
});

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
    .mutation(async ({ ctx, input }) => {
      const { organizationId, users: usersToAdd } = input;

      ctx.setMutationChannels([Channels.global()]);

      try {
        // Collect all unique IDs from the input
        const allRoleIds = Array.from(
          new Set(usersToAdd.flatMap((user) => user.roleId)),
        );
        const allAuthUserIds = usersToAdd.map((user) => user.authUserId);

        // Validate all entities exist
        const [organization, users, existingRoles] = await Promise.all([
          db.query.organizations.findFirst({
            where: (table, { eq }) => eq(table.id, organizationId),
          }),
          db.query.users.findMany({
            where: (table, { inArray }) =>
              inArray(table.authUserId, allAuthUserIds),
          }),
          db.query.accessRoles.findMany({
            where: (table, { inArray }) => inArray(table.id, allRoleIds),
            columns: { id: true },
          }),
        ]);

        // Check organization exists
        if (!organization) {
          throw new NotFoundError('Organization', organizationId);
        }

        // Check all users exist
        const existingAuthUserIds = new Set(
          users.map((user) => user.authUserId),
        );
        const invalidAuthUserIds = allAuthUserIds.filter(
          (authUserId) => !existingAuthUserIds.has(authUserId),
        );
        if (invalidAuthUserIds.length > 0) {
          throw new NotFoundError('User');
        }

        // Check all role IDs exist
        const existingRoleIds = new Set(existingRoles.map((role) => role.id));
        const invalidRoleIds = allRoleIds.filter(
          (roleId) => !existingRoleIds.has(roleId),
        );
        if (invalidRoleIds.length > 0) {
          throw new NotFoundError('Role');
        }

        // Join each user to the organization
        const joinResults = await Promise.all(
          users.map(async (user) => {
            const userToAdd = usersToAdd.find(
              (u) => u.authUserId === user.authUserId,
            );
            if (!userToAdd) {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'User to add not found',
              });
            }

            // Join the organization
            const orgUser = await joinOrganization({
              user,
              organization,
              roleId: userToAdd.roleId,
            });

            return {
              authUserId: user.authUserId,
              organizationUserId: orgUser.id,
            };
          }),
        );

        // Invalidate relevant caches for each added user
        await Promise.all([
          ...joinResults.map((addedUser) =>
            invalidate({
              type: 'orgUser',
              params: [organizationId, addedUser.authUserId],
            }),
          ),
        ]);

        waitUntil(
          realtime.publish(Channels.global(), {
            type: 'query-invalidation',
            queryKey: [['platform', 'admin', 'listAllUsers']] as const,
          }),
        );

        return joinResults;
      } catch (error) {
        if (error instanceof CommonError) {
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
