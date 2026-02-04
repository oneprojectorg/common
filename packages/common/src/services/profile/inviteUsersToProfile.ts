import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import { allowList, profileInvites } from '@op/db/schema';
import { Events, event } from '@op/events';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { CommonError, UnauthorizedError } from '../../utils/error';
import { getProfileAccessUser } from '../access';
import { assertProfile } from '../assert';

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
    existingPendingInvites,
    profileUser,
  ] = await Promise.all([
    // Get the profile details for the invite
    assertProfile(requesterProfileId),
    // Get the target role
    db.query.accessRoles.findFirst({
      where: { id: roleId },
    }),
    // Get all users with their profile memberships for this profile
    db.query.users.findMany({
      where: { email: { in: normalizedEmails } },
      with: {
        profileUsers: {
          where: { profileId: requesterProfileId },
        },
      },
    }),
    // Get all existing allowList entries for these emails
    db.query.allowList.findMany({
      where: { email: { in: normalizedEmails } },
    }),
    // Get existing pending invites for this profile (acceptedOn is null = pending)
    db.query.profileInvites.findMany({
      where: {
        email: { in: normalizedEmails },
        profileId: requesterProfileId,
        acceptedOn: { isNull: true },
      },
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

  const pendingInviteEmailsSet = new Set(
    existingPendingInvites.map((invite) => invite.email.toLowerCase()),
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

        // User exists but not in this profile - check for existing pending invite
        const hasPendingInvite = pendingInviteEmailsSet.has(email);

        if (hasPendingInvite) {
          results.failed.push({
            email,
            reason: 'User already has a pending invite to this profile',
          });
          continue;
        }

        // Create profile invite record (user already has an account, no need to add to allowList)
        await db.insert(profileInvites).values({
          email,
          profileId: requesterProfileId,
          profileEntityType: profile.type,
          accessRoleId: targetRole.id,
          invitedBy: profileUser.profileId,
          message: personalMessage,
        });

        // Prepare email for event-based sending
        emailsToInvite.push({
          email,
          inviterName: profileUser?.name || user.email || 'A team member',
          profileName: profile.name,
          inviteUrl: OPURLConfig('APP').ENV_URL,
          personalMessage,
        });
        continue;
      }

      // User doesn't exist - check for existing pending invite
      const hasPendingInvite = pendingInviteEmailsSet.has(email);

      if (hasPendingInvite) {
        results.failed.push({
          email,
          reason: 'User already has a pending invite to this profile',
        });
        continue;
      }

      // Add to allowList for signup authorization (without profile metadata)
      const isInAllowList = allowListEmailsSet.has(email);
      if (!isInAllowList) {
        await db.insert(allowList).values({
          email,
          organizationId: null,
          metadata: null,
        });
      }

      // Create profile invite record
      await db.insert(profileInvites).values({
        email,
        profileId: requesterProfileId,
        profileEntityType: profile.type,
        accessRoleId: targetRole.id,
        invitedBy: profileUser.profileId,
        message: personalMessage,
      });

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
