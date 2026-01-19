import { OPURLConfig } from '@op/core';
import { and, db, eq, ne } from '@op/db/client';
import {
  allowList,
  profileUserToAccessRoles,
  profileUsers,
  profiles,
} from '@op/db/schema';
import { Events, event } from '@op/events';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils/error';
import { getProfileAccessUser } from '../access';
import type { AllowListMetadata } from '../user/validators';

/**
 * Verify a profile exists and return it
 */
const getProfileById = async (profileId: string) => {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, profileId),
  });

  if (!profile) {
    throw new NotFoundError('Profile not found');
  }

  return profile;
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
  await getProfileById(profileId);

  // Check if user has ADMIN access on the profile
  const profileUser = await getProfileAccessUser({
    user,
    profileId,
  });

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
    const serviceUser = member.serviceUser as any;
    const userProfile = serviceUser?.profile;

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
  const profile = await getProfileById(profileId);

  // Check if user has ADMIN access on the profile
  const currentProfileUser = await getProfileAccessUser({
    user,
    profileId,
  });

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

  // If user exists in the system, add them directly
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
  // Get the profile user to find the profileId
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

  // Get the target role
  const targetRole = await db.query.accessRoles.findFirst({
    where: (table, { eq }) => eq(table.id, roleId),
  });

  if (!targetRole) {
    throw new CommonError('Invalid role specified');
  }

  // If target is currently admin and new role is not admin, check if there are other admins
  if (targetRole.name.toLowerCase() !== 'admin') {
    const adminRoleId = (
      await db.query.accessRoles.findFirst({
        where: (table, { ilike }) => ilike(table.name, 'admin'),
      })
    )?.id;

    if (adminRoleId) {
      // Get all admin members for this profile
      const adminMembers = await db.query.profileUsers.findMany({
        where: eq(profileUsers.profileId, profileId),
        with: {
          roles: {
            where: eq(profileUserToAccessRoles.accessRoleId, adminRoleId),
          },
        },
      });

      const adminCount = adminMembers.filter(
        (member) => member.roles.length > 0,
      ).length;

      // Check if target user is currently an admin
      const targetIsAdmin = adminMembers.some(
        (member) => member.id === profileUserId && member.roles.length > 0,
      );

      if (targetIsAdmin && adminCount <= 1) {
        throw new CommonError(
          'Cannot change role: this would leave the profile without an admin',
        );
      }
    }
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
  // Get the profile user to find the profileId
  const targetProfileUser = await db.query.profileUsers.findFirst({
    where: eq(profileUsers.id, profileUserId),
    with: {
      roles: {
        with: {
          accessRole: true,
        },
      },
    },
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

  // Prevent removal if user is the last admin
  const isTargetAdmin = targetProfileUser.roles.some(
    (role) => role.accessRole.name.toLowerCase() === 'admin',
  );

  if (isTargetAdmin) {
    // Get admin role ID
    const adminRoleId = (
      await db.query.accessRoles.findFirst({
        where: (table, { ilike }) => ilike(table.name, 'admin'),
      })
    )?.id;

    if (adminRoleId) {
      // Count admins (excluding the target user)
      const otherAdmins = await db.query.profileUsers.findMany({
        where: and(
          eq(profileUsers.profileId, profileId),
          ne(profileUsers.id, profileUserId),
        ),
        with: {
          roles: {
            where: eq(profileUserToAccessRoles.accessRoleId, adminRoleId),
          },
        },
      });

      const otherAdminCount = otherAdmins.filter(
        (member) => member.roles.length > 0,
      ).length;

      if (otherAdminCount === 0) {
        throw new CommonError(
          'Cannot remove member: this would leave the profile without an admin',
        );
      }
    }
  }

  // Delete the profile user (this cascades to profileUserToAccessRoles)
  await db.delete(profileUsers).where(eq(profileUsers.id, profileUserId));

  return { success: true };
};
