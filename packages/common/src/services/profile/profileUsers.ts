import { OPURLConfig } from '@op/core';
import { db, eq } from '@op/db/client';
import {
  type AccessRole,
  type Profile,
  type ProfileUser,
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
 * Type for profile user query result with relations.
 * Used for listProfileUsers which includes serviceUser.profile and roles.accessRole.
 */
type ProfileUserWithRelations = ProfileUser & {
  serviceUser: {
    profile:
      | (Pick<Profile, 'id' | 'name' | 'slug' | 'bio' | 'email' | 'type'> & {
          avatarImage: { id: string; name: string | null } | null;
        })
      | null;
  } | null;
  roles: Array<{
    accessRole: Pick<AccessRole, 'id' | 'name' | 'description'>;
  }>;
};

/**
 * List all members of a profile
 */
export const listProfileUsers = async ({
  profileId,
  user,
}: {
  profileId: string;
  user: User;
}) => {
  const [profileUser] = await Promise.all([
    getProfileAccessUser({ user, profileId }),
    assertProfile(profileId),
  ]);

  if (!profileUser) {
    throw new UnauthorizedError('You do not have access to this profile');
  }

  assertAccess({ profile: permission.ADMIN }, profileUser.roles ?? []);

  // Fetch all profile users with their roles and user profiles
  const members = await db.query.profileUsers.findMany({
    where: eq(profileUsers.profileId, profileId),
    with: {
      roles: {
        with: {
          accessRole: true,
        },
      },
      serviceUser: {
        with: {
          profile: {
            with: {
              avatarImage: true,
            },
          },
        },
      },
    },
    orderBy: (table, { asc }) => [asc(table.name), asc(table.email)],
  });

  // Transform the data to a clean format
  return members.map((member) => {
    const typedMember = member as ProfileUserWithRelations;
    const userProfile = typedMember.serviceUser?.profile;

    return {
      id: member.id,
      authUserId: member.authUserId,
      name: userProfile?.name || member.name,
      email: member.email,
      about: userProfile?.bio || member.about,
      profileId: member.profileId,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      profile: userProfile
        ? {
            id: userProfile.id,
            name: userProfile.name,
            slug: userProfile.slug,
            bio: userProfile.bio,
            email: userProfile.email,
            type: userProfile.type,
            avatarImage: userProfile.avatarImage
              ? {
                  id: userProfile.avatarImage.id,
                  name: userProfile.avatarImage.name,
                }
              : null,
          }
        : null,
      roles: member.roles.map((roleJunction) => ({
        id: roleJunction.accessRole.id,
        name: roleJunction.accessRole.name,
        description: roleJunction.accessRole.description,
      })),
    };
  });
};

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

  // Get the target role
  const targetRole = await db.query.accessRoles.findFirst({
    where: (table, { eq }) => eq(table.id, roleId),
  });

  if (!targetRole) {
    throw new CommonError('Invalid role specified');
  }

  // Check if user already exists in the system
  const existingUser = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.email, normalizedEmail),
    with: {
      profileUsers: {
        where: (table, { eq }) => eq(table.profileId, profileId),
      },
    },
  });

  // Check if user is already a member of this profile
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

/**
 * Update a profile member's role
 */
export const updateProfileUserRole = async ({
  profileUserId,
  roleId,
  user,
}: {
  profileUserId: string;
  roleId: string;
  user: User;
}) => {
  const targetProfileUser = await db.query.profileUsers.findFirst({
    where: eq(profileUsers.id, profileUserId),
  });

  if (!targetProfileUser) {
    throw new NotFoundError('Member not found');
  }

  const profileId = targetProfileUser.profileId;

  // Check if user has ADMIN access on the profile
  const currentProfileUser = await getProfileAccessUser({
    user,
    profileId,
  });

  if (!currentProfileUser) {
    throw new UnauthorizedError('You do not have access to this profile');
  }

  assertAccess({ profile: permission.ADMIN }, currentProfileUser.roles ?? []);

  // Validate the new role exists
  const targetRole = await db.query.accessRoles.findFirst({
    where: (table, { eq }) => eq(table.id, roleId),
  });

  if (!targetRole) {
    throw new CommonError('Invalid role specified');
  }

  // Update the role in a transaction
  await db.transaction(async (tx) => {
    // Remove all existing roles for this profile user
    await tx
      .delete(profileUserToAccessRoles)
      .where(eq(profileUserToAccessRoles.profileUserId, profileUserId));

    // Add the new role
    await tx.insert(profileUserToAccessRoles).values({
      profileUserId,
      accessRoleId: targetRole.id,
    });
  });

  return { success: true };
};

/**
 * Remove a member from a profile
 */
export const removeProfileUser = async ({
  profileUserId,
  user,
}: {
  profileUserId: string;
  user: User;
}) => {
  const targetProfileUser = await db.query.profileUsers.findFirst({
    where: eq(profileUsers.id, profileUserId),
  });

  if (!targetProfileUser) {
    throw new NotFoundError('Member not found');
  }

  const profileId = targetProfileUser.profileId;

  // Check if user has ADMIN access on the profile
  const currentProfileUser = await getProfileAccessUser({
    user,
    profileId,
  });

  if (!currentProfileUser) {
    throw new UnauthorizedError('You do not have access to this profile');
  }

  assertAccess({ profile: permission.ADMIN }, currentProfileUser.roles ?? []);

  // Delete the profile user (this cascades to profileUserToAccessRoles)
  await db.delete(profileUsers).where(eq(profileUsers.id, profileUserId));

  return { success: true };
};
