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
 * Add a member to a profile
 */
export const addProfileUser = async ({
  profileId,
  email,
  roleId,
  personalMessage,
  user,
}: {
  profileId: string;
  email: string;
  roleId: string;
  personalMessage?: string;
  user: User;
}) => {
  const [profile, currentProfileUser] = await Promise.all([
    assertProfile(profileId),
    getProfileAccessUser({ user, profileId }),
  ]);

  if (!currentProfileUser) {
    throw new UnauthorizedError('You do not have access to this profile');
  }

  assertAccess({ profile: permission.ADMIN }, currentProfileUser.roles ?? []);

  const normalizedEmail = email.toLowerCase();

  const [targetRole, existingUser] = await Promise.all([
    db.query.accessRoles.findFirst({
      where: (table, { eq }) => eq(table.id, roleId),
    }),
    db.query.users.findFirst({
      where: (table, { eq }) => eq(table.email, normalizedEmail),
      with: {
        profileUsers: {
          where: (table, { eq }) => eq(table.profileId, profileId),
        },
      },
    }),
  ]);

  if (!targetRole) {
    throw new CommonError('Invalid role specified');
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
        await tx.insert(profileUserToAccessRoles).values({
          profileUserId: newProfileUser.id,
          accessRoleId: targetRole.id,
        });
      }
    });

    // User already exists in the system - no need to send invite email
    return { success: true, email: normalizedEmail };
  }

  // Check if email is in the allowList
  const existingAllowListEntry = await db.query.allowList.findFirst({
    where: (table, { eq }) => eq(table.email, normalizedEmail),
  });

  if (!existingAllowListEntry) {
    const metadata: AllowListMetadata = {
      invitedBy: user.id,
      invitedAt: new Date().toISOString(),
      inviteType: 'profile',
      personalMessage,
      roleId,
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
          inviterName: currentProfileUser.name || user.email || 'A team member',
          profileName: profile.name,
          inviteUrl: OPURLConfig('APP').ENV_URL,
          personalMessage,
        },
      ],
    },
  });

  return { success: true, email: normalizedEmail };
};
