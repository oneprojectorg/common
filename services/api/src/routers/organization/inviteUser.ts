import { UnauthorizedError, sendInvitationEmail } from '@op/common';
import { OPURLConfig } from '@op/core';
import { allowList } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: `/organization/invite`,
    protect: true,
    tags: ['organization'],
    summary: 'Invite a user to join the organization',
  },
};

const inputSchema = z.object({
  email: z.string().email('Must be a valid email address'),
});

const outputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const inviteUserRouter = router({
  invite: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 60, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    // Router
    .meta(meta)
    .input(inputSchema)
    .output(outputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { db } = ctx.database;
        const { id: authUserId } = ctx.user;
        const { email } = input;

        // Get the current user's database record with organization details
        const authUser = await db.query.users.findFirst({
          where: (table, { eq }) => eq(table.authUserId, authUserId),
          with: {
            currentOrganization: {
              with: {
                profile: true,
              },
            },
          },
        });

        if (!authUser?.lastOrgId || !authUser.currentOrganization) {
          throw new UnauthorizedError(
            'User must be associated with an organization to send invites',
          );
        }

        // Check if email is already in the allowList
        const existingEntry = await db.query.allowList.findFirst({
          where: (table, { eq }) => eq(table.email, email),
        });

        if (existingEntry) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'User is already invited or has access to the platform',
          });
        }

        // Add the email to the allowList with the current user's organization
        await db.insert(allowList).values({
          email,
          organizationId: authUser.lastOrgId,
          metadata: {
            invitedBy: authUserId,
            invitedAt: new Date().toISOString(),
          },
        });

        // Send invitation email
        try {
          await sendInvitationEmail({
            to: email,
            inviterName: authUser.name || ctx.user.email || 'A team member',
            organizationName:
              (authUser.currentOrganization as any)?.profile?.name ||
              'the organization',
            inviteUrl: OPURLConfig('APP').ENV_URL,
          });
        } catch (emailError) {
          console.error('Failed to send invitation email:', emailError);
          // Note: We don't throw here to avoid rolling back the database insertion
          // The user has been added to the allow list even if email fails
        }

        return {
          success: true,
          message: `Invitation sent to ${email}`,
        };
      } catch (error) {
        // Re-throw TRPCError as-is
        if (error instanceof TRPCError) {
          throw error;
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
