import { invalidateMultiple } from '@op/cache';
import {
  UnauthorizedError,
  inviteNewUsers,
  inviteUsersToOrganization,
} from '@op/common';
import { db } from '@op/db/client';
import { TRPCError } from '@trpc/server';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const inputSchema = z
  .object({
    emails: z
      .array(z.email('Must be a valid email address'))
      .min(1, 'At least one email address is required'),
    roleId: z.uuid('Role ID must be a valid UUID').optional(),
    organizationId: z.uuid().optional(),
    personalMessage: z.string().optional(),
  })
  .or(
    z.object({
      email: z.email('Must be a valid email address'),
      roleId: z.uuid('Role ID must be a valid UUID'),
      organizationId: z.uuid().optional(),
      personalMessage: z.string().optional(),
    }),
  )
  .refine(
    (data) => {
      // If organizationId is provided, roleId must also be provided
      if (data.organizationId && !data.roleId) {
        return false;
      }
      return true;
    },
    {
      path: ['roleId'],
      error: 'Role ID is required when inviting to an organization',
    },
  );

const outputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  details: z
    .object({
      successful: z.array(z.string()),
      failed: z.array(
        z.object({
          email: z.string(),
          reason: z.string(),
        }),
      ),
    })
    .optional(),
});

export const inviteUserRouter = router({
  invite: commonAuthedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 10 },
  })
    .input(inputSchema)
    .output(outputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { user } = ctx;

        const emailsToProcess =
          'emails' in input ? input.emails : [input.email];
        const roleId = input.roleId;
        const targetOrganizationId = input.organizationId;
        const personalMessage = input.personalMessage;

        if (targetOrganizationId && roleId) {
          const result = await inviteUsersToOrganization({
            emails: emailsToProcess,
            roleId: roleId,
            organizationId: targetOrganizationId,
            personalMessage,
            user,
          });

          // Invalidate caches for users who were successfully added to the organization
          if (result.details?.successful.length > 0) {
            // Find existing users by email to get their auth user IDs
            const existingUsers = await db._query.users.findMany({
              where: (table, { inArray }) =>
                inArray(table.email, result.details.successful),
              columns: { authUserId: true },
            });

            if (existingUsers.length > 0) {
              const userIds = existingUsers.map((u) => u.authUserId);
              waitUntil(
                invalidateMultiple({
                  type: 'user',
                  paramsList: userIds.map((id) => [id]),
                }),
              );
            }
          }

          return result;
        } else {
          return inviteNewUsers({
            emails: emailsToProcess,
            personalMessage,
            user,
          });
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        // Handle specific errors
        if (
          error instanceof Error &&
          error.message.includes('User must be associated')
        ) {
          throw new UnauthorizedError(error.message);
        }

        // Handle other errors
        const message =
          error instanceof Error ? error.message : 'Failed to send invitation';

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),
});
