import {
  UnauthorizedError,
  inviteNewUsers,
  inviteUsersToOrganization,
} from '@op/common';
import { TRPCError } from '@trpc/server';
// import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

// const meta: OpenApiMeta = {
// openapi: {
// enabled: true,
// method: 'POST',
// path: `/organization/invite`,
// protect: true,
// tags: ['organization'],
// summary: 'Invite a user to join the organization',
// },
// };

const inputSchema = z
  .object({
    emails: z
      .array(z.string().email('Must be a valid email address'))
      .min(1, 'At least one email address is required'),
    roleId: z.string().uuid('Role ID must be a valid UUID').optional(),
    organizationId: z.string().uuid().optional(),
    personalMessage: z.string().optional(),
  })
  .or(
    z.object({
      email: z.string().email('Must be a valid email address'),
      roleId: z.string().uuid('Role ID must be a valid UUID'),
      organizationId: z.string().uuid().optional(),
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
      message: 'Role ID is required when inviting to an organization',
      path: ['roleId'],
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
  invite: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 60, maxRequests: 10 }))
    .use(withAuthenticated)
    // Router
    // .meta(meta)
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
          return inviteUsersToOrganization({
            emails: emailsToProcess,
            roleId: roleId,
            organizationId: targetOrganizationId,
            personalMessage,
            user,
          });
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
