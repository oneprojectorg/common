import { cache, invalidate } from '@op/cache';
import { getAllowListUser, joinOrganization } from '@op/common';
import { db } from '@op/db/client';
import { allowList } from '@op/db/schema';
import { createSBServiceClient } from '@op/supabase/server';
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
        roleId: z.string(),
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
    .mutation(async ({ input, ctx }) => {
      const { organizationId, users: usersToAdd } = input;

      try {
        // Collect all unique IDs from the input
        const allRoleIds = Array.from(
          new Set(usersToAdd.flatMap((user) => user.roleId)),
        );
        const allAuthUserIds = usersToAdd.map((user) => user.authUserId);

        const supabase = createSBServiceClient();
        // Validate all entities exist
        // TODO: we should replace all these queries with utilities that assert existence, e.g `assertOrganization`, `assertAccessRoles`, `assertUsers` and remove the manual checks below.
        const [organization, existingRoles, ...existingUsers] =
          await Promise.all([
            // Validate organization exists
            db.query.organizations.findFirst({
              where: (table, { eq }) => eq(table.id, organizationId),
            }),
            // Validate all role IDs exist
            db.query.accessRoles.findMany({
              where: (table, { inArray }) => inArray(table.id, allRoleIds),
              columns: { id: true },
            }),
            // Validate all users exist and get their details
            // TODO: do we need both auth.users and users? or do we have type guarantees?
            //
            ...allAuthUserIds.map((authUserId) =>
              supabase.auth.admin
                .getUserById(authUserId)
                .then(({ data, error }) => {
                  if (error || !data?.user) {
                    throw new TRPCError({
                      code: 'NOT_FOUND',
                      message: `User(s) ID: ${authUserId} not found`,
                    });
                  }

                  return data.user;
                }),
            ),
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

        // Ensure each user has an allowList entry.
        // If not, we create one for them with metadata invitation based on the platform admin adding them
        // TODO: move all this logic in joinOrganization
        await Promise.all(
          existingUsers.map(async (user) => {
            if (!user.email) {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `User with ID ${user.id} does not have an email`,
              });
            }
            const userEmail = user.email.toLowerCase();

            // Check if allowList entry exists
            const allowListUser = await cache<
              ReturnType<typeof getAllowListUser>
            >({
              type: 'allowList',
              params: [userEmail],
              fetch: () => getAllowListUser({ email: userEmail }),
              options: {
                storeNulls: true,
                ttl: 30 * 60 * 1000,
              },
            });

            if (allowListUser) {
              return allowListUser;
            }
            // Create allowList entry if it doesn't exist
            const userToAdd = usersToAdd.find((u) => u.authUserId === user.id);
            if (!userToAdd) {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'User to add not found',
              });
            }

            const [addedAllowListUser] = await db
              .insert(allowList)
              .values({
                email: userEmail,
                organizationId,
                metadata: {
                  invitedBy: ctx.user.id,
                  invitedAt: new Date().toISOString(),
                  inviteType: 'existing_organization',
                  roleId: userToAdd.roleId,
                  organizationId,
                },
              })
              .returning();

            if (!addedAllowListUser) {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to create allowList entry',
              });
            }

            return allowListUser;
          }),
        );

        // Join each user to the organization
        const joinResults = await Promise.all(
          existingUsers.map(async (user) => {
            if (!user.email) {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `User with ID ${user.id} does not have an email`,
              });
            }

            // Join the organization
            const orgUser = await joinOrganization({
              user,
              organization,
            });

            return {
              authUserId: user.id,
              organizationUserId: orgUser.id,
            };
          }),
        );

        // Invalidate relevant caches for each added user
        await Promise.all(
          joinResults.map((addedUser) =>
            invalidate({
              type: 'orgUser',
              params: [organizationId, addedUser.authUserId],
            }),
          ),
        );

        return joinResults;
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
