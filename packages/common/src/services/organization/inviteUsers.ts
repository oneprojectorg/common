import { db } from '@op/db/client';
import { allowList } from '@op/db/schema';
import { sendInvitationEmail } from '../email';
import { OPURLConfig } from '@op/core';

export interface InviteUsersInput {
  emails: string[];
  role?: string;
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

export const inviteUsersToOrganization = async (input: InviteUsersInput): Promise<InviteResult> => {
  const { emails, role = 'Admin', organizationId, personalMessage, authUserId, authUserEmail } = input;

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
    throw new Error('User must be associated with an organization to send invites');
  }

  const currentProfile =
    authUser.currentProfile ??
    (authUser.currentOrganization as any)?.profile;

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
        // Determine metadata based on whether it's a new organization invite
        const metadata = organizationId
          ? {
              invitedBy: authUserId,
              invitedAt: new Date().toISOString(),
              inviteType: 'new_organization',
              personalMessage: personalMessage,
              inviterOrganizationName:
                (currentProfile as any)?.profile?.name || 'Common',
            }
          : {
              invitedBy: authUserId,
              invitedAt: new Date().toISOString(),
              personalMessage: personalMessage,
              role,
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
          inviterName:
            authUser?.name || authUserEmail || 'A team member',
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