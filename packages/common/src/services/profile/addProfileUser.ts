import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import { allowList, profileInvites } from '@op/db/schema';
import { Events, event } from '@op/events';
import type { User } from '@op/supabase/lib';
import { waitUntil } from '@vercel/functions';
import { assertAccess, permission } from 'access-zones';

import { CommonError, UnauthorizedError } from '../../utils/error';
import { getProfileAccessUser } from '../access';
import { assertProfile } from '../assert';

/**
 * Add a member to a profile with one or more roles
 */
export const addProfileUser = async ({
  profileId,
  inviteeEmail,
  roleIdsToAssign,
  personalMessage,
  currentUser,
}: {
  profileId: string;
  inviteeEmail: string;
  roleIdsToAssign: string[];
  personalMessage?: string;
  currentUser: User;
}) => {
  if (roleIdsToAssign.length === 0) {
    throw new CommonError('At least one role must be specified');
  }

  const roleIdsToAssignDeduped = [...new Set(roleIdsToAssign)];
  const normalizedEmail = inviteeEmail.toLowerCase();

  const [
    profile,
    currentProfileUser,
    validRoles,
    existingUser,
    existingPendingInvite,
    existingAllowListEntry,
  ] = await Promise.all([
    assertProfile(profileId),
    getProfileAccessUser({ user: currentUser, profileId }),
    db._query.accessRoles.findMany({
      where: (table, { inArray }) => inArray(table.id, roleIdsToAssignDeduped),
    }),
    db._query.users.findFirst({
      where: (table, { eq }) => eq(table.email, normalizedEmail),
      with: {
        profileUsers: {
          where: (table, { eq }) => eq(table.profileId, profileId),
        },
      },
    }),
    db._query.profileInvites.findFirst({
      where: (table, { and, eq, isNull }) =>
        and(
          eq(table.email, normalizedEmail),
          eq(table.profileId, profileId),
          isNull(table.acceptedOn),
        ),
    }),
    db._query.allowList.findFirst({
      where: (table, { eq }) => eq(table.email, normalizedEmail),
    }),
  ]);

  if (!currentProfileUser) {
    throw new UnauthorizedError('You do not have access to this profile');
  }

  assertAccess({ profile: permission.ADMIN }, currentProfileUser.roles ?? []);

  if (validRoles.length !== roleIdsToAssignDeduped.length) {
    const validRoleIds = new Set(validRoles.map((r) => r.id));
    const invalidRoleIds = roleIdsToAssignDeduped.filter(
      (id) => !validRoleIds.has(id),
    );
    throw new CommonError(
      `Invalid role(s) specified: ${invalidRoleIds.join(', ')}`,
    );
  }

  if (existingUser && existingUser.profileUsers.length > 0) {
    throw new CommonError('User is already a member of this profile');
  }

  // If user exists in the system, check for pending invite then create one
  // (user already has an account, no need to add to allowList)
  if (existingUser) {
    if (existingPendingInvite) {
      throw new CommonError(
        'User already has a pending invite to this profile',
      );
    }

    // Create profile invite record (using first role for the invite)
    const primaryRoleId = roleIdsToAssignDeduped[0]!;
    await db.insert(profileInvites).values({
      email: normalizedEmail,
      profileId,
      profileEntityType: profile.type,
      accessRoleId: primaryRoleId,
      invitedBy: currentProfileUser.profileId,
      message: personalMessage,
    });

    // Send invite email via event
    waitUntil(
      event.send({
        name: Events.profileInviteSent.name,
        data: {
          senderProfileId: currentProfileUser.profileId,
          invitations: [
            {
              email: normalizedEmail,
              inviterName:
                currentProfileUser.name || currentUser.email || 'A team member',
              profileName: profile.name,
              inviteUrl: OPURLConfig('APP').ENV_URL,
              personalMessage,
            },
          ],
        },
      }),
    );

    return { email: normalizedEmail, invited: true as const };
  }

  // Check for existing pending invite
  if (existingPendingInvite) {
    throw new CommonError('User already has a pending invite to this profile');
  }

  // Add to allowList for signup authorization (without profile metadata)
  if (!existingAllowListEntry) {
    await db.insert(allowList).values({
      email: normalizedEmail,
      organizationId: null,
      metadata: null,
    });
  }

  // Create profile invite record (using first role for the invite)
  // roleIdsToAssignDeduped is guaranteed to have at least one element (checked at function start)
  const primaryRoleId = roleIdsToAssignDeduped[0]!;
  await db.insert(profileInvites).values({
    email: normalizedEmail,
    profileId,
    profileEntityType: profile.type,
    accessRoleId: primaryRoleId,
    invitedBy: currentProfileUser.profileId,
    message: personalMessage,
  });

  // Send invite email via event
  waitUntil(
    event.send({
      name: Events.profileInviteSent.name,
      data: {
        senderProfileId: currentProfileUser.profileId,
        invitations: [
          {
            email: normalizedEmail,
            inviterName:
              currentProfileUser.name || currentUser.email || 'A team member',
            profileName: profile.name,
            inviteUrl: OPURLConfig('APP').ENV_URL,
            personalMessage,
          },
        ],
      },
    }),
  );

  return { email: normalizedEmail, invited: true as const };
};
