import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import {
  allowList,
  organizationUserToAccessRoles,
  organizationUsers,
} from '@op/db/schema';

import { sendInvitationEmail } from '../email';

export interface InviteUsersInput {
  emails: string[];
  roleId: string;
  organizationId?: string;
  personalMessage?: string;
  authUserId: string;
  authUserEmail?: string;
}

export interface InviteResult {
  success: boolean;
  message: string;
  details: {
    successful: string[];
    failed: { email: string; reason: string }[];
  };
}

export const inviteUsersToOrganization = async (
  input: InviteUsersInput,
): Promise<InviteResult> => {
  const {
    emails,
    roleId,
    organizationId,
    personalMessage,
    authUserId,
    authUserEmail,
  } = input;

  // Get the current user's database record with organization details
  const authUser = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.authUserId, authUserId),
    with: {
      currentOrganization: {
        with: {
          profile: true,
        },
      },
      currentProfile: true,
    },
  });

  // For new organization invites, we don't need the user to be in an organization
  // For existing organization invites, we do need it
  if (
    (!authUser?.currentProfileId && !authUser?.lastOrgId) ||
    (!authUser.currentOrganization && !authUser.currentProfile)
  ) {
    throw new Error(
      'User must be associated with an organization to send invites',
    );
  }

  const currentProfile =
    authUser.currentProfile ?? (authUser.currentOrganization as any)?.profile;

  const results = {
    successful: [] as string[],
    failed: [] as { email: string; reason: string }[],
  };

  // Process each email
  for (const rawEmail of emails) {
    const email = rawEmail.toLowerCase();
    try {
      // Only handle existing organization invites (not new organization invites)
      if (organizationId) {
        // Check if user already exists in the system
        const existingUser = await db.query.users.findFirst({
          where: (table, { eq }) => eq(table.email, email),
          with: {
            organizationUsers: {
              where: (table, { eq }) =>
                eq(table.organizationId, organizationId),
            },
          },
        });

        if (existingUser) {
          // User exists - check if they're already in this organization
          if (existingUser.organizationUsers.length === 0) {
            // User exists but not in this organization - add them directly
            const targetRole = await db.query.accessRoles.findFirst({
              where: (table, { eq }) => eq(table.id, roleId),
            });

            if (targetRole) {
              await db.transaction(async (tx) => {
                // Add user to organization
                const [newOrgUser] = await tx
                  .insert(organizationUsers)
                  .values({
                    authUserId: existingUser.authUserId,
                    organizationId,
                    email: existingUser.email,
                    name: existingUser.name || existingUser.email.split('@')[0],
                  })
                  .returning();

                // Assign role
                if (newOrgUser) {
                  await tx.insert(organizationUserToAccessRoles).values({
                    organizationUserId: newOrgUser.id,
                    accessRoleId: targetRole.id,
                  });
                }
              });

              results.successful.push(email);
              continue; // Skip email sending for existing users
            }
          } else {
            // User already in organization
            results.failed.push({
              email,
              reason: 'User is already a member of this organization',
            });
            continue;
          }
        }
      }

      // Check if email is already in the allowList
      const existingEntry = await db.query.allowList.findFirst({
        where: (table, { eq }) => eq(table.email, email),
      });

      if (!existingEntry) {
        // Determine metadata based on whether it's a new organization invite
        const metadata = organizationId
          ? {
              invitedBy: authUserId,
              invitedAt: new Date().toISOString(),
              inviteType: 'existing_organization',
              personalMessage: personalMessage,
              roleId,
              organizationId,
            }
          : {
              invitedBy: authUserId,
              invitedAt: new Date().toISOString(),
              inviteType: 'new_organization',
              personalMessage: personalMessage,
              inviterOrganizationName:
                currentProfile?.profile?.name || 'Common',
            };

        // Add the email to the allowList
        await db.insert(allowList).values({
          email,
          organizationId: organizationId ?? null,
          metadata,
        });
      }

      // Send invitation email
      try {
        await sendInvitationEmail({
          to: email,
          inviterName: authUser?.name || authUserEmail || 'A team member',
          organizationName: organizationId
            ? (authUser?.currentOrganization as any)?.profile?.name ||
              'an organization'
            : undefined,
          inviteUrl: OPURLConfig('APP').ENV_URL,
          message: personalMessage,
        });
        results.successful.push(email);
      } catch (emailError) {
        console.error(
          `Failed to send invitation email to ${email}:`,
          emailError,
        );
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

  const totalEmails = emails.length;
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
};
