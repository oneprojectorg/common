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
    .mutation(async () => {
      // TODO: Implement the handler logic
      // Will accept: { input } and destructure: const { organizationId, users } = input;

      try {
        // TODO: Validate organization exists
        // TODO: Validate role IDs exist
        // TODO: Validate users exist
        // TODO: Check users are not already in the organization
        // TODO: Use database transaction for atomicity
        // TODO: Invalidate relevant caches

        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'Endpoint not yet implemented',
        });
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
