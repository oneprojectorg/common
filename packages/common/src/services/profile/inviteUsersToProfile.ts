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
 * Invite users to a profile with roles.
 * Each invitation specifies an email and roleId, allowing per-user role assignment.
 */
export const inviteUsersToProfile = async ({
  invitations,
  requesterProfileId,
  personalMessage,
  user,
}: {
  invitations: Array<{ email: string; roleId: string }>;
  requesterProfileId: string;
  personalMessage?: string;
  user: User;
}) => {
  if (invitations.length === 0) {
    throw new CommonError('At least one invitation is required');
  }

  const normalizedInvitations = invitations.map((inv) => ({
    email: inv.email.toLowerCase(),
    roleId: inv.roleId,
  }));

  const normalizedEmails = normalizedInvitations.map((inv) => inv.email);
  const uniqueRoleIds = [
    ...new Set(normalizedInvitations.map((inv) => inv.roleId)),
  ];

  const [
    profile,
    targetRoles,
    existingUsers,
    existingAllowListEntries,
    existingPendingInvites,
    profileUser,
  ] = await Promise.all([
    // Get the profile details for the invite
    assertProfile(requesterProfileId),
    // Get all target roles
    db._query.accessRoles.findMany({
      where: (table, { inArray }) => inArray(table.id, uniqueRoleIds),
    }),
    // Get all users with their profile memberships for this profile
    db._query.users.findMany({
      where: (table, { inArray }) => inArray(table.email, normalizedEmails),
      with: {
        profileUsers: {
          where: (table, { eq }) => eq(table.profileId, requesterProfileId),
        },
      },
    }),
    // Get all existing allowList entries for these emails
    db._query.allowList.findMany({
      where: (table, { inArray }) => inArray(table.email, normalizedEmails),
    }),
    // Get existing pending invites for this profile (acceptedOn is null = pending)
    db._query.profileInvites.findMany({
      where: (table, { inArray, eq, and, isNull }) =>
        and(
          inArray(table.email, normalizedEmails),
          eq(table.profileId, requesterProfileId),
          isNull(table.acceptedOn),
        ),
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

  assertAccess({ profile: permission.ADMIN }, profileUser.roles ?? []);

  // Validate all roles exist
  const rolesById = new Map(targetRoles.map((r) => [r.id, r]));
  const invalidRoleIds = uniqueRoleIds.filter((id) => !rolesById.has(id));
  if (invalidRoleIds.length > 0) {
    throw new CommonError(
      `Invalid role(s) specified: ${invalidRoleIds.join(', ')}`,
    );
  }

  const results = {
    successful: [] as string[],
    failed: [] as { email: string; reason: string }[],
    // Auth user IDs of existing users who were successfully invited (for cache invalidation)
    existingUserAuthIds: [] as string[],
  };

  const emailsToInvite: Array<{
    email: string;
    authUserId?: string; // Only set for existing users
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

  // Process each invitation
  for (const invitation of normalizedInvitations) {
    const { email, roleId } = invitation;
    try {
      const existingUser = usersByEmail.get(email);
      const targetRole = rolesById.get(roleId)!;

      // Check for pending invite (applies to both existing and new users)
      if (pendingInviteEmailsSet.has(email)) {
        results.failed.push({
          email,
          reason: 'User already has a pending invite to this profile',
        });
        continue;
      }

      // If existing user, check if already a member
      if (
        existingUser &&
        existingProfileUserAuthIds.has(existingUser.authUserId)
      ) {
        results.failed.push({
          email,
          reason: 'User is already a member of this profile',
        });
        continue;
      }

      // Use transaction to ensure allowList and profileInvites are created atomically
      await db.transaction(async (tx) => {
        // If new user (no account), add to allowList for signup authorization
        if (!existingUser && !allowListEmailsSet.has(email)) {
          await tx.insert(allowList).values({
            email,
            organizationId: null,
            metadata: null,
          });
        }

        // Create profile invite record
        await tx.insert(profileInvites).values({
          email,
          profileId: requesterProfileId,
          profileEntityType: profile.type,
          accessRoleId: targetRole.id,
          invitedBy: profileUser.profileId,
          message: personalMessage,
        });
      });

      // Add to emailsToInvite (with authUserId if existing user)
      emailsToInvite.push({
        email,
        authUserId: existingUser?.authUserId,
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
      // Collect auth user IDs for existing users (for cache invalidation)
      results.existingUserAuthIds.push(
        ...emailsToInvite
          .filter((e): e is typeof e & { authUserId: string } => !!e.authUserId)
          .map((e) => e.authUserId),
      );
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
    normalizedInvitations.length,
  );

  return {
    success: results.successful.length > 0,
    message,
    details: {
      successful: results.successful,
      failed: results.failed,
      existingUserAuthIds: results.existingUserAuthIds,
    },
  };
};
