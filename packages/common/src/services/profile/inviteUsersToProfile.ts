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

import { CommonError, UnauthorizedError } from '../../utils/error';
import { getProfileAccessUser } from '../access';
import { assertProfile } from '../assert';
import { AllowListMetadata } from '../user/validators';

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
export const inviteUsersToProfile = async (input: {
  emails: string[];
  roleId: string;
  requesterProfileId: string;
  personalMessage?: string;
  user: User;
}) => {
  const { emails, roleId, requesterProfileId, personalMessage, user } = input;

  const normalizedEmails = emails.map((e) => e.toLowerCase());

  const [
    profile,
    targetRole,
    existingUsers,
    existingAllowListEntries,
    profileUser,
  ] = await Promise.all([
    // Get the profile details for the invite
    assertProfile(requesterProfileId),
    // Get the target role
    db.query.accessRoles.findFirst({
      where: (table, { eq }) => eq(table.id, roleId),
    }),
    // Get all users with their profile memberships for this profile
    db.query.users.findMany({
      where: (table, { inArray }) => inArray(table.email, normalizedEmails),
      with: {
        profileUsers: {
          where: (table, { eq }) => eq(table.profileId, requesterProfileId),
        },
      },
    }),
    // Get all existing allowList entries for these emails
    db.query.allowList.findMany({
      where: (table, { inArray }) => inArray(table.email, normalizedEmails),
    }),
    getProfileAccessUser({
      user,
      profileId: requesterProfileId,
    }),
  ]);

  if (!profileUser) {
    throw new UnauthorizedError(
      'User must be associated with this profile to send invites',
    );
  }

  // If this is the inviter's profile, we let them through. Otherwise assert admin access
  if (profileUser.profileId !== requesterProfileId) {
    assertAccess({ profile: permission.ADMIN }, profileUser.roles || []);
  }

  if (!targetRole) {
    throw new CommonError('Invalid role specified for profile invite');
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

  const usersByEmail = new Map(
    existingUsers.map((user) => [user.email.toLowerCase(), user]),
  );

  const existingProfileUserAuthIds = new Set(
    existingUsers
      .filter((user) => user.profileUsers.length > 0)
      .map((user) => user.authUserId),
  );

  const allowListEmailsSet = new Set(
    existingAllowListEntries.map((entry) => entry.email.toLowerCase()),
  );

  // Process each email
  for (const rawEmail of emails) {
    const email = rawEmail.toLowerCase();
    try {
      // Look up user from the batched results
      const existingUser = usersByEmail.get(email);

      // Check if user is already a member of this profile
      if (existingUser) {
        const isAlreadyMember = existingProfileUserAuthIds.has(
          existingUser.authUserId,
        );

        if (isAlreadyMember) {
          results.failed.push({
            email,
            reason: 'User is already a member of this profile',
          });
          continue;
        }

        // User exists but not in this profile - add them directly
        await db.transaction(async (tx) => {
          // Add user to profile
          const [newProfileUser] = await tx
            .insert(profileUsers)
            .values({
              authUserId: existingUser.authUserId,
              profileId: requesterProfileId,
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
          }
        });
      }

      // Check if email is already in the allowList using the Set
      const isInAllowList = allowListEmailsSet.has(email);

      if (!isInAllowList) {
        const metadata: AllowListMetadata = {
          invitedBy: user.id,
          invitedAt: new Date().toISOString(),
          inviteType: 'profile',
          personalMessage: personalMessage,
          roleId,
          profileId: requesterProfileId,
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
        data: {
          senderProfileId: profileUser.profileId,
          invitations: emailsToInvite,
        },
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

  const message = generateInviteResultMessage(
    results.successful.length,
    emails.length,
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
