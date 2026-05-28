import { cache } from '@op/cache';
import { and, db, eq } from '@op/db/client';
import type { Profile, ProfileUser } from '@op/db/schema';
import { organizations, users } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import type { AccessZonePermissionInput, NormalizedRole } from 'access-zones';
import { checkPermission } from 'access-zones';
import { z } from 'zod';

import { UnauthorizedError } from '../../utils/error';
import { GLOBAL_USER_ANONYMOUS_ID, GLOBAL_USER_PUBLIC_ID } from './globalUser';
import { type RoleJunction, getNormalizedRoles } from './utils';

/**
 * Resolves the auth-user-id used for permission lookups:
 *
 * - real authed user → their own id
 * - anon-JWT caller → `GLOBAL_USER_ANONYMOUS_ID`
 * - no-JWT caller (`user === undefined`) → `GLOBAL_USER_PUBLIC_ID`
 *
 * The two `GLOBAL_USER_*` ids point at real seeded `auth.users` rows
 * that no human can sign in as. Profiles grant role X "to anonymous
 * callers" / "to no-JWT callers" by attaching role X to the
 * corresponding global user via `profile_users` — so this substitution
 * keeps the standard `profile_users -> access_roles` join working for
 * un-anchored callers.
 */
export const resolveAccessAuthUserId = (
  user: { id: string; is_anonymous?: boolean | null } | undefined,
): string => {
  if (!user) {
    return GLOBAL_USER_PUBLIC_ID;
  }
  if (user.is_anonymous) {
    return GLOBAL_USER_ANONYMOUS_ID;
  }
  return user.id;
};

type OrgUserWithNormalizedRoles = {
  id: string;
  authUserId: string;
  name: string | null;
  email: string;
  about: string | null;
  organizationId: string;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
  deletedAt?: string | Date | null;
  roles: NormalizedRole[];
};

type ProfileUserWithNormalizedRoles = ProfileUser & {
  roles: NormalizedRole[];
  profile: Profile;
};

/**
 * Resolves the caller's org-user row. Pass `undefined` for no-JWT
 * callers; the lookup falls back to the seeded GLOBAL_USER_PUBLIC row.
 * Anon-JWT callers fall back to GLOBAL_USER_ANONYMOUS.
 */
export const getOrgAccessUser = async ({
  user,
  organizationId,
}: {
  user: { id: string; is_anonymous?: boolean | null } | undefined;
  organizationId: string;
}): Promise<OrgUserWithNormalizedRoles | undefined> => {
  const accessAuthUserId = resolveAccessAuthUserId(user);

  const getOrgUser = async () => {
    const orgUser = await db._query.organizationUsers.findFirst({
      where: (table, { eq }) =>
        and(
          eq(table.organizationId, organizationId),
          eq(table.authUserId, accessAuthUserId),
        ),
      with: {
        roles: {
          with: {
            accessRole: {
              with: {
                zonePermissions: {
                  with: {
                    accessZone: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!orgUser) {
      return;
    }

    // Transform the relational data into normalized format for access-zones library
    // Type assertion needed because Drizzle query result type is complex but we know it has the right structure
    const normalizedRoles = getNormalizedRoles(
      orgUser.roles as Array<Pick<RoleJunction, 'accessRole'>>,
    );

    const { roles: _, ...orgUserWithoutRoles } = orgUser;

    // Replace roles with normalized format
    return {
      ...orgUserWithoutRoles,
      roles: normalizedRoles,
    };
  };

  return cache({
    type: 'orgUser',
    params: [organizationId, accessAuthUserId],
    fetch: getOrgUser,
    options: {
      skipMemCache: true,
    },
  });
};

/**
 * Resolves the caller's profile-user row. Pass `undefined` for no-JWT
 * callers; the lookup falls back to the seeded GLOBAL_USER_PUBLIC row.
 * Anon-JWT callers fall back to GLOBAL_USER_ANONYMOUS.
 */
export const getProfileAccessUser = async ({
  user,
  profileId,
}: {
  user: { id: string; is_anonymous?: boolean | null } | undefined;
  profileId: string;
}): Promise<ProfileUserWithNormalizedRoles | undefined> => {
  const accessAuthUserId = resolveAccessAuthUserId(user);

  const profileUser = await db._query.profileUsers.findFirst({
    where: (table, { eq }) =>
      and(
        eq(table.profileId, profileId),
        eq(table.authUserId, accessAuthUserId),
      ),
    with: {
      profile: true,
      roles: {
        with: {
          accessRole: {
            with: {
              zonePermissions: {
                with: {
                  accessZone: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!profileUser) {
    return undefined;
  }

  // Transform the relational data into normalized format for access-zones library
  // Type assertion needed because Drizzle query result type is complex but we know it has the right structure
  const normalizedRoles = getNormalizedRoles(
    profileUser.roles as Array<Pick<RoleJunction, 'accessRole'>>,
  );

  const { roles: _, ...profileUserWithoutRoles } = profileUser;
  return {
    ...profileUserWithoutRoles,
    profile: profileUser.profile as Profile,
    roles: normalizedRoles,
  };
};

/**
 * Asserts profile-level access, falling back to org-level access if the user
 * doesn't have a profileUser role on the given profile.
 *
 * Uses `instance.profileId` for the profile-level check and
 * `instance.ownerProfileId` for the org-level fallback lookup.
 */
export const assertInstanceProfileAccess = async ({
  user,
  instance,
  profilePermissions,
  orgFallbackPermissions,
}: {
  user: { id: string; is_anonymous?: boolean | null } | undefined;
  instance: { profileId: string | null; ownerProfileId: string | null };
  profilePermissions: AccessZonePermissionInput;
  orgFallbackPermissions: AccessZonePermissionInput;
}) => {
  if (!instance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  const profileUser = await getProfileAccessUser({
    user,
    profileId: instance.profileId,
  });

  const hasProfileAccess = checkPermission(
    profilePermissions,
    profileUser?.roles ?? [],
  );

  if (!hasProfileAccess) {
    if (!instance.ownerProfileId) {
      throw new UnauthorizedError("You don't have access to do this");
    }

    const org = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.profileId, instance.ownerProfileId));

    if (!org[0]?.id) {
      throw new UnauthorizedError("You don't have access to do this");
    }

    const orgUser = await getOrgAccessUser({
      user,
      organizationId: org[0].id,
    });

    if (!checkPermission(orgFallbackPermissions, orgUser?.roles ?? [])) {
      throw new UnauthorizedError("You don't have access to do this");
    }
  }
};

export const getCurrentProfileId = async (authUserId: string) => {
  const validatedAuthUserId = validateAuthUserId(authUserId);
  const { user } =
    (await getUserSession({ authUserId: validatedAuthUserId })) ?? {};

  if (!user) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  // Primary: use currentProfileId if available
  if (user.currentProfileId) {
    return user.currentProfileId;
  }

  // Fallback: if lastOrgId exists but currentProfileId doesn't, convert it
  if (user.lastOrgId) {
    try {
      const [org] = await db
        .select({ profileId: organizations.profileId })
        .from(organizations)
        .where(eq(organizations.id, user.lastOrgId))
        .limit(1);

      if (org) {
        return org.profileId;
      }
    } catch (error) {
      console.error('Error converting lastOrgId to profileId:', error);
    }
  }

  throw new UnauthorizedError("You don't have access to do this");
};

export const getIndividualProfileId = async (authUserId: string) => {
  const validatedAuthUserId = validateAuthUserId(authUserId);
  const { user } =
    (await getUserSession({ authUserId: validatedAuthUserId })) ?? {};

  if (!user) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  if (user.profileId) {
    return user.profileId;
  }

  throw new UnauthorizedError("You don't have an individual profile");
};

export const getCurrentOrgId = async ({
  authUserId,
}: {
  authUserId: string;
}) => {
  const validatedAuthUserId = validateAuthUserId(authUserId);
  const { user } =
    (await getUserSession({ authUserId: validatedAuthUserId })) ?? {};

  if (!user) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  // Primary: use currentProfileId if available
  if (user.currentProfileId) {
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.profileId, user.currentProfileId))
      .limit(1);

    if (org) {
      return org.id;
    }
  }

  // Fallback: use lastOrgId directly if currentProfileId doesn't work
  if (user.lastOrgId) {
    return user.lastOrgId;
  }

  throw new UnauthorizedError("You don't have access to do this");
};

export const getCurrentOrgUserId = async (
  organizationId: string,
  authUserId: string,
) => {
  const validatedAuthUserId = validateAuthUserId(authUserId);
  const session = await getUserSession({ authUserId: validatedAuthUserId });

  if (!session?.user) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  const orgUser = await getOrgAccessUser({
    user: { id: session.user.authUserId } as User,
    organizationId,
  });

  if (!orgUser) {
    throw new UnauthorizedError("You don't have access to this organization");
  }

  return orgUser.id;
};

// UTILITY FUNCTIONS FOR AUTH VALIDATION

const authUserIdSchema = z.uuid('Invalid authentication user ID format');

export const validateAuthUserId = (authUserId: string | undefined) => {
  if (!authUserId) {
    throw new UnauthorizedError('Authentication required');
  }

  try {
    return authUserIdSchema.parse(authUserId);
  } catch {
    throw new UnauthorizedError('Invalid authentication credentials');
  }
};

/**
 * Gets user session data by authUserId (database-only, no Supabase auth)
 * Used internally
 */
export const getUserSession = async ({
  authUserId,
}: {
  authUserId: string;
}) => {
  const validatedAuthUserId = validateAuthUserId(authUserId);

  try {
    const dbUser = await db._query.users.findFirst({
      where: (table, { eq }) => eq(table.authUserId, validatedAuthUserId),
      with: {
        organizationUsers: true,
      },
    });

    if (!dbUser) {
      return null;
    }

    // Backwards compatibility: migrate lastOrgId to currentProfileId if needed
    if (dbUser.lastOrgId && !dbUser.currentProfileId) {
      try {
        const [org] = await db
          .select({ profileId: organizations.profileId })
          .from(organizations)
          .where(eq(organizations.id, dbUser.lastOrgId))
          .limit(1);

        if (org) {
          // Update the user with the profile ID
          await db
            .update(users)
            .set({ currentProfileId: org.profileId })
            .where(eq(users.authUserId, validatedAuthUserId));

          // Return the updated user object
          return { user: { ...dbUser, currentProfileId: org.profileId } };
        }
      } catch (migrationError) {
        console.error('Migration error:', migrationError);
        // Continue with the original user object if migration fails
      }
    }

    return { user: dbUser };
  } catch (error) {
    console.error('ERROR');
    return null;
  }
};

export * from './assertProfileTypeAccess';
export * from './getRoles';
export * from './globalUser';
export * from './permissions';
export * from './utils';
export * from './platformAdmin';
