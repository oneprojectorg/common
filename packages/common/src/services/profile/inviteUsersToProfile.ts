import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import {
  allowList,
  profileUserToAccessRoles,
  profileUsers,
} from '@op/db/schema';
import { Events, event } from '@op/events';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { getProfileAccessUser } from '../access';

export interface InviteUsersToProfileInput {
  emails: string[];
  roleId: string;
  profileId: string;
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

// Type definitions for invite metadata
interface InviteMetadata {
  invitedBy: string;
  invitedAt: string;
  inviteType: 'profile';
  personalMessage?: string;
  roleId?: string;
  profileId?: string;
  inviterProfileName?: string;
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

/**
 * Invite users to a profile with a specific role
 */
export const inviteUsersToProfile = async (
  input: InviteUsersToProfileInput,
): Promise<InviteResult> => {
  const { emails, roleId, profileId, personalMessage, user } = input;

  const profileUser = await getProfileAccessUser({ user, profileId });

  if (!profileUser) {
    throw new Error(
      'User must be associated with this profile to send invites',
    );
  }

  assertAccess({ profile: permission.ADMIN }, profileUser.roles || []);

  // Get the profile details for the invite
  const profile = await db.query.profiles.findFirst({
    where: (table, { eq }) => eq(table.id, profileId),
  });

  if (!profile) {
    throw new Error('Profile not found');
  }

  const results = {
    successful: [] as string[],
    failed: [] as { email: string; reason: string }[],
  };

  const emailsToInvite: Array<{
    email: string;
    inviterName: string;
    profileName: string;
    inviteUrl: string;
    personalMessage?: string;
  }> = [];

  // Process each email
  for (const rawEmail of emails) {
    const email = rawEmail.toLowerCase();
    try {
      // Check if user already exists in the system
      const existingUser = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.email, email),
      });

      // Check if user is already a member of this profile
      if (existingUser) {
        const existingProfileUser = await db.query.profileUsers.findFirst({
          where: (table, { eq, and }) =>
            and(
              eq(table.profileId, profileId),
              eq(table.authUserId, existingUser.authUserId),
            ),
        });

        if (existingProfileUser) {
          results.failed.push({
            email,
            reason: 'User is already a member of this profile',
          });
          continue;
        }

        // User exists but not in this profile - add them directly
        const targetRole = await db.query.accessRoles.findFirst({
          where: (table, { eq }) => eq(table.id, roleId),
        });

        if (targetRole) {
          await db.transaction(async (tx) => {
            // Add user to profile
            const [newProfileUser] = await tx
              .insert(profileUsers)
              .values({
                authUserId: existingUser.authUserId,
                profileId,
                email: existingUser.email,
                name: existingUser.name || existingUser.email.split('@')[0],
              })
              .returning();

            // Assign role
            if (newProfileUser) {
              await tx.insert(profileUserToAccessRoles).values({
                profileUserId: newProfileUser.id,
                accessRoleId: targetRole.id,
              });
            } else {
              console.error('Could not add user to profile');
            }
          });

          results.successful.push(email);
          continue; // Skip email sending for existing users
        } else {
          console.error('Invalid role specified for profile invite');

          results.failed.push({
            email,
            reason: 'Invalid role specified for profile invite',
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
          inviteType: 'profile',
          personalMessage: personalMessage,
          roleId,
          profileId,
          inviterProfileName: profile.name,
        };

        // Add the email to the allowList
        await db.insert(allowList).values({
          email,
          organizationId: null,
          metadata,
        });
      }

      // Prepare email for event-based sending
      emailsToInvite.push({
        email,
        inviterName: profileUser?.name || user.email || 'A team member',
        profileName: profile.name,
        inviteUrl: OPURLConfig('APP').ENV_URL,
        personalMessage,
      });
    } catch (error) {
      console.error(`Failed to process invitation for ${email}:`, error);
      results.failed.push({
        email,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Send single event with all invitations - workflow handles retries per email
  if (emailsToInvite.length > 0) {
    try {
      await event.send({
        name: Events.profileInviteSent.name,
        data: { invitations: emailsToInvite },
      });

      // Mark all as successful since invite was processed
      results.successful.push(...emailsToInvite.map((e) => e.email));
    } catch (eventError) {
      console.error('Failed to send profile invite event:', eventError);

      // Mark all as failed since event couldn't be queued
      emailsToInvite.forEach((emailData) => {
        results.failed.push({
          email: emailData.email,
          reason: 'Failed to queue invitation email.',
        });
      });
    }
  }

  const totalEmails = emails.length;
  const message = generateInviteResultMessage(
    results.successful.length,
    totalEmails,
  );

  return {
    success: results.successful.length > 0,
    message,
    details: {
      successful: results.successful,
      failed: results.failed,
    },
  };
};
