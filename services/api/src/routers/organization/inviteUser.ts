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
  emails: z
    .array(z.string().email('Must be a valid email address'))
    .min(1, 'At least one email address is required'),
  role: z.string().default('Admin'),
  organizationId: z.string().uuid().optional(),
}).or(
  z.object({
    email: z.string().email('Must be a valid email address'),
    role: z.string().default('Admin').optional(),
    organizationId: z.string().uuid().optional(),
  })
);

const outputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  details: z.object({
    successful: z.array(z.string()),
    failed: z.array(z.object({
      email: z.string(),
      reason: z.string(),
    })),
  }).optional(),
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

        // Handle both single email and multiple emails input
        const emailsToProcess = 'emails' in input ? input.emails : [input.email];
        const role = 'role' in input ? input.role : 'Admin';
        const targetOrganizationId = 'organizationId' in input ? input.organizationId : undefined;

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

        const results = {
          successful: [] as string[],
          failed: [] as { email: string; reason: string }[],
        };

        // Process each email
        for (const email of emailsToProcess) {
          try {
            // Check if email is already in the allowList
            const existingEntry = await db.query.allowList.findFirst({
              where: (table, { eq }) => eq(table.email, email),
            });

            if (existingEntry) {
              results.failed.push({
                email,
                reason: 'User is already invited or has access to the platform',
              });
              continue;
            }

            // Add the email to the allowList with the specified or current organization
            await db.insert(allowList).values({
              email,
              organizationId: targetOrganizationId || authUser.lastOrgId,
              metadata: {
                invitedBy: authUserId,
                invitedAt: new Date().toISOString(),
                role,
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
              results.successful.push(email);
            } catch (emailError) {
              console.error(`Failed to send invitation email to ${email}:`, emailError);
              // Email failed but database insertion succeeded
              results.successful.push(email);
            }
          } catch (error) {
            console.error(`Failed to process invitation for ${email}:`, error);
            results.failed.push({
              email,
              reason: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        const totalEmails = emailsToProcess.length;
        const successCount = results.successful.length;

        let message: string;
        if (successCount === totalEmails) {
          message = `All ${totalEmails} invitation${totalEmails > 1 ? 's' : ''} sent successfully`;
        } else if (successCount > 0) {
          message = `${successCount} of ${totalEmails} invitations sent successfully`;
        } else {
          message = 'No invitations were sent successfully';
        }

        return {
          success: successCount > 0,
          message,
          details: {
            successful: results.successful,
            failed: results.failed,
          },
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
