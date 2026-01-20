import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import {
  allowList,
  profileUserToAccessRoles,
  profileUsers,
} from '@op/db/schema';
import { Events, event } from '@op/events';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { CommonError, UnauthorizedError } from '../../utils/error';
import { getProfileAccessUser } from '../access';
import { assertProfile } from '../assert';
import type { AllowListMetadata } from '../user/validators';

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

  const roleIdsToAssignDeduped = Array.from(new Set(roleIdsToAssign));

  const [profile, currentProfileUser] = await Promise.all([
    assertProfile(profileId),
    getProfileAccessUser({ user: currentUser, profileId }),
  ]);

  if (!currentProfileUser) {
    throw new UnauthorizedError('You do not have access to this profile');
  }

  assertAccess({ profile: permission.ADMIN }, currentProfileUser.roles ?? []);

  const normalizedEmail = inviteeEmail.toLowerCase();

  const [validRoles, existingUser] = await Promise.all([
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
  ]);

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

  // If user exists in the system, add them directly and return early (no invite email needed)
  if (existingUser) {
    await db.transaction(async (tx) => {
      const [newProfileUser] = await tx
        .insert(profileUsers)
        .values({
          authUserId: existingUser.authUserId,
          profileId,
          email: existingUser.email,
          name: existingUser.name || existingUser.email.split('@')[0],
        })
        .returning();

      if (newProfileUser) {
        await tx.insert(profileUserToAccessRoles).values(
          roleIdsToAssignDeduped.map((accessRoleId) => ({
            profileUserId: newProfileUser.id,
            accessRoleId,
          })),
        );
      }
    });

    // User already exists in the system - no need to send invite email
    return { email: normalizedEmail };
  }

  // Check if email is in the allowList
  const existingAllowListEntry = await db._query.allowList.findFirst({
    where: (table, { eq }) => eq(table.email, normalizedEmail),
  });

  if (!existingAllowListEntry) {
    const metadata: AllowListMetadata = {
      invitedBy: currentUser.id,
      invitedAt: new Date().toISOString(),
      inviteType: 'profile',
      personalMessage,
      roleIds: roleIdsToAssignDeduped,
      profileId,
      inviterProfileName: profile.name,
    };

    await db.insert(allowList).values({
      email: normalizedEmail,
      organizationId: null,
      metadata,
    });
  }

  // Send invite email via event
  await event.send({
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
  });

  return { success: true, email: normalizedEmail };
};
