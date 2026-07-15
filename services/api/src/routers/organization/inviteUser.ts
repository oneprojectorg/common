import { invalidateMultiple } from '@op/cache';
import { inviteNewUsers, inviteUsersToOrganization } from '@op/common';
import { db } from '@op/db/client';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

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
  invite: networkAuthenticatedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 10 },
  })
    .input(inputSchema)
    .output(outputSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const emailsToProcess = 'emails' in input ? input.emails : [input.email];
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
          const existingUsers = await db.query.users.findMany({
            where: { email: { in: result.details.successful } },
            columns: { authUserId: true },
          });

          if (existingUsers.length > 0) {
            const userIds = existingUsers.map((u) => u.authUserId);
            // Await — `waitUntil` would let the response return before the
            // cache bust completed, so a follow-up request from these users
            // could still see the pre-invite membership.
            await invalidateMultiple({
              type: 'user',
              paramsList: userIds.map((id) => [id]),
            });
          }
        }

        return result;
      }

      return inviteNewUsers({
        emails: emailsToProcess,
        personalMessage,
        user,
      });
    }),
});
