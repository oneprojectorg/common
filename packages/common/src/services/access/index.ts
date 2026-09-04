import { cache, invalidate } from '@op/cache';
import { db, eq } from '@op/db/client';
import { organizations, users } from '@op/db/schema';
import { logger } from '@op/logging';
import type { AccessZonePermissionInput, NormalizedRole } from 'access-zones';
import { checkPermission } from 'access-zones';
import { z } from 'zod';

import { UnauthorizedError } from '../../utils/error';
import type { OrganizationUserBase } from '../organization/schemas/organizationUser';
import type { ProfileMinimal } from '../profile/schemas/profileMinimal';
import type { ProfileUserBase } from '../profile/schemas/profileUser';
import {
  type AccessUser,
  orgUserCacheKey,
  profileUserCacheKey,
  resolveAccessUserIds,
} from './cacheKeys';
import { memoize } from './requestCache';
import { getNormalizedRoles, zonePermissionsWhere } from './utils';

export type OrgUserWithNormalizedRoles = OrganizationUserBase & {
  roles: NormalizedRole[];
};

export type ProfileUserWithNormalizedRoles = ProfileUserBase & {
  roles: NormalizedRole[];
  profile: ProfileMinimal;
};

export {
  type AccessUser,
  orgUserCacheKey,
  profileUserCacheKey,
  resolveAccessUserIds,
  resolveAccountUserId,
} from './cacheKeys';

/**
 * Collapse the grant rows matched for a caller (their own ∪ the public
 * {@link GLOBAL_USER_PUBLIC} grant) into a single access record: prefer the
 * caller's own row for identity fields, but union the roles across every
 * matched row. `rows` must be non-empty.
 */
const mergeGrantRows = <
  TRow extends {
    authUserId: string;
    roles: Parameters<typeof getNormalizedRoles>[0];
  },
>(
  rows: TRow[],
  user?: AccessUser,
  profileId?: string,
): { baseRow: TRow; normalizedRoles: NormalizedRole[] } => {
  const ownRow = rows.find((row) => row.authUserId === user?.id);
  return {
    baseRow: ownRow ?? rows[0]!,
    normalizedRoles: rows.flatMap((row) =>
      getNormalizedRoles(row.roles, { profileId }),
    ),
  };
};

// gets a user assuming that the user is authenticated
export const getOrgAccessUser = memoize(
  async ({
    user,
    organizationId,
  }: {
    user?: AccessUser;
    organizationId: string;
  }): Promise<OrgUserWithNormalizedRoles | undefined> => {
    const authUserIds = resolveAccessUserIds(user);

    const getOrgUser = async () => {
      const orgUsers = await db.query.organizationUsers.findMany({
        where: {
          organizationId,
          authUserId: { in: authUserIds },
        },
        with: {
          roles: {
            with: {
              accessRole: {
                with: {
                  zonePermissions: {
                    where: zonePermissionsWhere(),
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

      if (orgUsers.length === 0) {
        return;
      }

      // Org context: no profileId — only global (profileId IS NULL) zone
      // permission rows apply; per-profile override rows are a profile/instance
      // concept and never count toward org-level access.
      const { baseRow, normalizedRoles } = mergeGrantRows(orgUsers, user);

      const { roles: _, ...orgUserWithoutRoles } = baseRow;

      // Replace roles with normalized format
      return {
        ...orgUserWithoutRoles,
        roles: normalizedRoles,
      };
    };

    return cache({
      type: 'orgUser',
      params: orgUserCacheKey({ user, organizationId }),
      fetch: getOrgUser,
      options: {
        skipMemCache: true,
      },
    });
  },
  (args) => orgUserCacheKey(args).join(':'),
);

// Don't import directly — use getProfileAccessRoles. Exported only so role
// mutations can call .invalidate on the memoized cache.
export const getProfileAccessUser = memoize(
  async ({
    user,
    profileId,
  }: {
    user?: AccessUser;
    profileId: string;
  }): Promise<ProfileUserWithNormalizedRoles | undefined> => {
    const authUserIds = resolveAccessUserIds(user);

    const getProfileUser = async () => {
      const profileUserRows = await db.query.profileUsers.findMany({
        where: {
          profileId,
          authUserId: { in: authUserIds },
        },
        with: {
          profile: {
            with: {
              avatarImage: true,
            },
          },
          roles: {
            with: {
              accessRole: {
                with: {
                  zonePermissions: {
                    where: zonePermissionsWhere(profileId),
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

      if (profileUserRows.length === 0) {
        return undefined;
      }

      const { baseRow, normalizedRoles } = mergeGrantRows(
        profileUserRows,
        user,
        profileId,
      );

      const { roles: _, ...profileUserWithoutRoles } = baseRow;
      return {
        ...profileUserWithoutRoles,
        profile: baseRow.profile,
        roles: normalizedRoles,
      };
    };

    return cache({
      type: 'profileUser',
      params: profileUserCacheKey({ user, profileId }),
      fetch: getProfileUser,
      options: {
        skipMemCache: true,
      },
    });
  },
  (args) => profileUserCacheKey(args).join(':'),
);

/**
 * The caller's effective roles on a profile (own grant ∪ public grant), without
 * the join-table identity row. Empty when no grant matched — so `roles.length
 * > 0` means "has at least one effective role", slightly tighter than the old
 * presence check, which also held for a row with zero effective roles.
 *
 * No org fallback — see {@link getProfileAccessRolesWithOrgFallback} for that.
 */
export const getProfileAccessRoles = async ({
  user,
  profileId,
}: {
  user?: AccessUser;
  profileId: string;
}): Promise<NormalizedRole[]> =>
  (await getProfileAccessUser({ user, profileId }))?.roles ?? [];

/**
 * Resolve the caller's normalized roles on a profile, falling back to their
 * org-level roles when that profile is an organization's profile. The same
 * built-in-fallback shape as `assertInstanceProfileAccess` /
 * `resolveInstanceAccess`, returning just the roles (every caller only
 * `checkPermission`s on them). Empty when the caller has no grant.
 *
 * Why it's needed: org grants live on `organizationUsers`, not `profileUsers`,
 * so a `getProfileAccessUser` lookup on an org's profile never sees an org
 * admin/member. Prefer the profile-level grant when present (matching
 * `resolveInstanceAccess`); fall back to the org only when the profile carries
 * no grant of its own.
 */
export const getProfileAccessRolesWithOrgFallback = async ({
  user,
  profileId,
}: {
  user?: AccessUser;
  profileId: string;
}): Promise<NormalizedRole[]> => {
  const profileUser = await getProfileAccessUser({ user, profileId });
  if (profileUser) {
    return profileUser.roles;
  }

  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.profileId, profileId));
  if (!org?.id) {
    return [];
  }

  const orgUser = await getOrgAccessUser({ user, organizationId: org.id });
  return orgUser?.roles ?? [];
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
  user?: AccessUser;
  instance: { profileId: string | null; ownerProfileId: string | null };
  profilePermissions: AccessZonePermissionInput;
  orgFallbackPermissions: AccessZonePermissionInput;
}): Promise<NormalizedRole[]> => {
  if (!instance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  const profileRoles = await getProfileAccessRoles({
    user,
    profileId: instance.profileId,
  });

  const hasProfileAccess = checkPermission(profilePermissions, profileRoles);

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

  // Profile-level roles only (empty when admitted via the org fallback).
  return profileRoles;
};

// Memoized per request (keyed by authUserId): the current profile is stable
// within a request, so callers that each resolve it independently — e.g.
// submitUserFlag and the assertModerationItemAccess gate it invokes — share a
// single lookup instead of re-hitting getUserSession + the org fallback.
export const getCurrentProfileId = memoize(
  async (authUserId: string) => {
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
        logger.error('Error converting lastOrgId to profileId', { error });
      }
    }

    throw new UnauthorizedError("You don't have access to do this");
  },
  (authUserId) => authUserId,
);

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
    user: { id: session.user.authUserId },
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
export const getUserSession = memoize(
  async ({ authUserId }: { authUserId: string }) => {
    const validatedAuthUserId = validateAuthUserId(authUserId);

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
        logger.error('Migration error', { error: migrationError });
        // Continue with the original user object if migration fails
      }
    }

    return { user: dbUser };
  },
  ({ authUserId }) => authUserId,
);

/**
 * Drop every cache layer that can serve a caller a stale role set on a
 * profile: the durable Redis `profileUser` and `user` entries (72h TTL) plus
 * the request-scoped memoized lookups. Must run after ANY write that creates,
 * changes, or removes a profileUsers membership or its roles — a missed site
 * leaves the user on their old (e.g. visitor) roles until the TTL expires.
 */
export const invalidateProfileUserAccessCache = async ({
  authUserId,
  profileId,
}: {
  authUserId: string;
  profileId: string;
}) => {
  await Promise.all([
    invalidate({
      type: 'profileUser',
      params: profileUserCacheKey({ user: { id: authUserId }, profileId }),
    }),
    invalidate({
      type: 'user',
      params: [authUserId],
    }),
  ]);
  getProfileAccessUser.invalidate({ user: { id: authUserId }, profileId });
  getUserSession.invalidate({ authUserId });
};

export * from './assertProfileTypeAccess';
export * from './getRoles';
export * from './permissions';
export * from './requestCache';
export * from './utils';
export * from './platformAdmin';
export * from './publicAccess';
