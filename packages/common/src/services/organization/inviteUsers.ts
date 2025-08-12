import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import {
  allowList,
  organizationUserToAccessRoles,
  organizationUsers,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { getOrgAccessUser } from '../access';
import { sendInvitationEmail } from '../email';

// Type definitions for invite metadata
export interface InviteMetadata {
  invitedBy: string;
  invitedAt: string;
  inviteType: 'existing_organization' | 'new_organization';
  personalMessage?: string;
  roleId?: string;
  organizationId?: string;
  inviterOrganizationName?: string;
}

// Utility function to generate consistent result messages
const generateInviteResultMessage = (
  successCount: number,
  totalEmails: number,
): string => {
  if (successCount === totalEmails) {
    return `All ${totalEmails} invitation${totalEmails > 1 ? 's' : ''} sent successfully`;
  } else if (successCount > 0) {
    return `${successCount} of ${totalEmails} invitations sent successfully`;
  } else {
    return 'No invitations were sent successfully';
  }
};

export interface InviteUsersToOrganizationInput {
  emails: string[];
  roleId: string;
  organizationId: string;
  personalMessage?: string;

  user: User;
}

export interface InviteNewUsersInput {
  emails: string[];
  personalMessage?: string;
  user: User;
}

export interface InviteResult {
  success: boolean;
  message: string;
  details: {
    successful: string[];
    failed: { email: string; reason: string }[];
  };
}

/**
 * Invite users to an existing organization with a specific role
 */
export const inviteUsersToOrganization = async (
  input: InviteUsersToOrganizationInput,
): Promise<InviteResult> => {
  const { emails, roleId, organizationId, personalMessage, user } = input;

  const orgUser = await getOrgAccessUser({ user, organizationId });

  if (!orgUser) {
    throw new Error(
      'User must be associated with an organization to send organization invites',
    );
  }

  assertAccess({ profile: permission.ADMIN }, orgUser.roles || []);

  const authUser = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.authUserId, user.id),
    with: {
      currentOrganization: {
        with: {
          profile: true,
        },
      },
      currentProfile: true,
    },
  });

  const results = {
    successful: [] as string[],
    failed: [] as { email: string; reason: string }[],
  };

  // Process each email
  for (const rawEmail of emails) {
    const email = rawEmail.toLowerCase();
    try {
      // Check if user already exists in the system
      const existingUser = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.email, email),
        with: {
          organizationUsers: {
            where: (table, { eq }) => eq(table.organizationId, organizationId),
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
          } else {
            // Role not found
            results.failed.push({
              email,
              reason: 'Invalid role specified for organization invite',
            });
            continue;
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

      // Check if email is already in the allowList
      const existingEntry = await db.query.allowList.findFirst({
        where: (table, { eq }) => eq(table.email, email),
      });

      if (!existingEntry) {
        const metadata: InviteMetadata = {
          invitedBy: user.id,
          invitedAt: new Date().toISOString(),
          inviteType: 'existing_organization',
          personalMessage: personalMessage,
          roleId,
          organizationId,
        };

        // Add the email to the allowList
        await db.insert(allowList).values({
          email,
          organizationId,
          metadata,
        });
      }

      // Send invitation email
      try {
        await sendInvitationEmail({
          to: email,
          inviterName: orgUser?.name || user.email || 'A team member',
          organizationName:
            (authUser?.currentOrganization as any)?.profile?.name ||
            'an organization',
          inviteUrl: OPURLConfig('APP').ENV_URL,
          message: personalMessage,
        });
        results.successful.push(email);
      } catch (emailError) {
        console.error(
          `Failed to send invitation email to ${email}:`,
          emailError,
        );
        // Email failed but database insertion succeeded - track as partial success
        results.failed.push({
          email,
          reason:
            'Invitation recorded but email delivery failed. User may need to be re-invited.',
        });
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
  const message = generateInviteResultMessage(successCount, totalEmails);

  return {
    success: successCount > 0,
    message,
    details: {
      successful: results.successful,
      failed: results.failed,
    },
  };
};

/**
 * Invite new users to create their own organizations
 */
export const inviteNewUsers = async (
  input: InviteNewUsersInput,
): Promise<InviteResult> => {
  const { emails, personalMessage, user } = input;

  // Get the current user's database record with profile details
  const authUser = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.authUserId, user.id),
    with: {
      currentOrganization: {
        with: {
          profile: true,
        },
      },
      currentProfile: true,
    },
  });

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
      // Check if email is already in the allowList
      const existingEntry = await db.query.allowList.findFirst({
        where: (table, { eq }) => eq(table.email, email),
      });

      if (!existingEntry) {
        const metadata: InviteMetadata = {
          invitedBy: user.id,
          invitedAt: new Date().toISOString(),
          inviteType: 'new_organization',
          personalMessage: personalMessage,
          inviterOrganizationName: currentProfile?.profile?.name || 'Common',
        };

        // Add the email to the allowList
        await db.insert(allowList).values({
          email,
          organizationId: null,
          metadata,
        });
      }

      // Send invitation email
      try {
        await sendInvitationEmail({
          to: email,
          inviterName: authUser?.name || user.email || 'A team member',
          organizationName: 'Common', // General platform invite for new users
          inviteUrl: OPURLConfig('APP').ENV_URL,
          message: personalMessage,
        });
        results.successful.push(email);
      } catch (emailError) {
        console.error(
          `Failed to send invitation email to ${email}:`,
          emailError,
        );
        // Email failed but database insertion succeeded - track as partial success
        results.failed.push({
          email,
          reason:
            'Invitation recorded but email delivery failed. User may need to be re-invited.',
        });
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
  const message = generateInviteResultMessage(successCount, totalEmails);

  return {
    success: successCount > 0,
    message,
    details: {
      successful: results.successful,
      failed: results.failed,
    },
  };
};
