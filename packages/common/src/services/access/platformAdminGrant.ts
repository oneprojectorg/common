import { and, db, eq } from '@op/db/client';
import { profileUserToAccessRoles, profileUsers, users } from '@op/db/schema';

import { NotFoundError } from '../../utils/error';
import { invalidateProfileUserAccessCache } from './index';
import { PLATFORM_ADMIN_ROLE_NAME } from './platformAdmin';

/**
 * The membership row a user-level grant is written to: the row on the user's
 * OWN individual profile, created for every user by the signup trigger. Both
 * conditions matter — `users.profileId` picks the individual profile and
 * `profileUsers.authUserId` picks the user's own row on it.
 */
const resolveOwnProfileMembership = async ({
  authUserId,
}: {
  authUserId: string;
}): Promise<{ profileUserId: string; profileId: string }> => {
  const [membership] = await db
    .select({
      profileUserId: profileUsers.id,
      profileId: profileUsers.profileId,
    })
    .from(users)
    .innerJoin(
      profileUsers,
      and(
        eq(profileUsers.profileId, users.profileId),
        eq(profileUsers.authUserId, users.authUserId),
      ),
    )
    .where(eq(users.authUserId, authUserId))
    .limit(1);

  if (!membership) {
    throw new NotFoundError('Individual profile membership', authUserId);
  }

  return membership;
};

const resolvePlatformAdminRoleId = async (): Promise<string> => {
  const role = await db.query.accessRoles.findFirst({
    where: { name: PLATFORM_ADMIN_ROLE_NAME, profileId: { isNull: true } },
    columns: { id: true },
  });

  if (!role) {
    throw new NotFoundError('Role', PLATFORM_ADMIN_ROLE_NAME);
  }

  return role.id;
};

/**
 * Grants the platform-wide admin role to a user. Idempotent. Not exposed
 * through tRPC — an operator or the seed calls it. See ADR 0005.
 */
export const grantPlatformAdmin = async ({
  authUserId,
}: {
  authUserId: string;
}): Promise<void> => {
  const [{ profileUserId, profileId }, accessRoleId] = await Promise.all([
    resolveOwnProfileMembership({ authUserId }),
    resolvePlatformAdminRoleId(),
  ]);

  await db
    .insert(profileUserToAccessRoles)
    .values({ profileUserId, accessRoleId })
    .onConflictDoNothing();

  await invalidateProfileUserAccessCache({ authUserId, profileId });
};

/** Removes the platform-wide admin role from a user. Idempotent. */
export const revokePlatformAdmin = async ({
  authUserId,
}: {
  authUserId: string;
}): Promise<void> => {
  const [{ profileUserId, profileId }, accessRoleId] = await Promise.all([
    resolveOwnProfileMembership({ authUserId }),
    resolvePlatformAdminRoleId(),
  ]);

  await db
    .delete(profileUserToAccessRoles)
    .where(
      and(
        eq(profileUserToAccessRoles.profileUserId, profileUserId),
        eq(profileUserToAccessRoles.accessRoleId, accessRoleId),
      ),
    );

  await invalidateProfileUserAccessCache({ authUserId, profileId });
};
