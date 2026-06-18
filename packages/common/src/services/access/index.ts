import { cache } from '@op/cache';
import { GLOBAL_USER_PUBLIC } from '@op/core';
import { and, db, eq, isNull } from '@op/db/client';
import {
  accessRoles,
  organizations,
  profileUserToAccessRoles,
  profileUsers,
  users,
} from '@op/db/schema';
import { PUBLIC_PARTICIPANT_ROLE_NAME } from '@op/db/seedData/accessControl';
import type { User } from '@op/supabase/lib';
import type { AccessZonePermissionInput, NormalizedRole } from 'access-zones';
import { checkPermission } from 'access-zones';
import { z } from 'zod';

import { UnauthorizedError } from '../../utils/error';
import type { OrganizationUserBase } from '../organization/schemas/organizationUser';
import type { ProfileMinimal } from '../profile/schemas/profileMinimal';
import type { ProfileUserBase } from '../profile/schemas/profileUser';
import { memoize } from './requestCache';
import { getNormalizedRoles, zonePermissionsWhere } from './utils';

export type OrgUserWithNormalizedRoles = OrganizationUserBase & {
  roles: NormalizedRole[];
};

export type ProfileUserWithNormalizedRoles = ProfileUserBase & {
  roles: NormalizedRole[];
  profile: ProfileMinimal;
};

/**
 * The caller identity the access layer needs. A subset of the Supabase `User`
 * (only the id is read today); widen the `Pick` as later auth work needs more
 * fields. Optional throughout the access layer so a future no-JWT (public)
 * caller can be represented as `undefined` — resolvers fail closed on it.
 */
export type AccessUser = Pick<User, 'id'>;

/**
 * The set of auth-user ids whose grants make up a caller's *effective* access:
 * their own grants unioned with grants made to the public ({@link
 * GLOBAL_USER_PUBLIC}). So a no-JWT caller resolves only public grants, while an
 * authenticated or anonymous caller gets their own grants **and** any public
 * grant on the resource — that's what makes a "public" resource visible to
 * everyone (members, logged-in non-members, anonymous sessions, and no-JWT
 * visitors alike) without losing a caller's own (e.g. participant) grants.
 *
 * Always returns a non-empty set (at minimum the public sentinel), so an
 * undefined id can never drop the `authUserId` filter (Drizzle skips undefined
 * conditions — the fail-open trap). Use this everywhere grants are filtered —
 * `{ in: … }` / `inArray(…)` — and `.join(':')` it where a scalar cache-key
 * identity is needed.
 */
export const resolveAccessUserIds = (user?: AccessUser): string[] =>
  user?.id && user.id !== GLOBAL_USER_PUBLIC
    ? [user.id, GLOBAL_USER_PUBLIC]
    : [GLOBAL_USER_PUBLIC];

/**
 * Cache key for the durable `orgUser` cache. Shared by the write site and every
 * invalidator so the key shape can't drift — the resolved id set (own ∪ public)
 * is part of the identity, so a stale `[organizationId, user.id]` key would miss
 * and serve removed/demoted members their old roles until TTL.
 */
export const orgUserCacheKey = ({
  user,
  organizationId,
}: {
  user?: AccessUser;
  organizationId: string;
}): [string, string] => [organizationId, resolveAccessUserIds(user).join(':')];

/**
 * Cache key for profile-access lookups. Mirrors {@link orgUserCacheKey}: the
 * resolved id set (own ∪ public) is part of the identity. NOTE:
 * {@link getProfileAccessUser} has no durable cache today, so this currently
 * only keys the request-scoped memo — but it keeps the shape in one place for
 * symmetry and if a durable profile-access cache is ever added.
 */
export const profileUserCacheKey = ({
  user,
  profileId,
}: {
  user?: AccessUser;
  profileId: string;
}): [string, string] => [profileId, resolveAccessUserIds(user).join(':')];

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
  },
  (args) => profileUserCacheKey(args).join(':'),
);

/**
 * The Public Participant grant on a profile, resolved as role junctions ready
 * for {@link getNormalizedRoles}. Detected by the stable global Public
 * Participant *role* (by name, `profileId IS NULL`) granted on the profile —
 * not by the {@link GLOBAL_USER_PUBLIC} sentinel row the grant is currently
 * anchored on. The cheap path (no public grant, i.e. almost every profile) is a
 * single indexed existence check; the role's permissions are only loaded when a
 * grant is actually present. Empty when the profile has no public grant.
 */
const getPublicParticipantRoleJunctions = async (profileId: string) => {
  const grant = await db
    .select({ profileUserId: profileUserToAccessRoles.profileUserId })
    .from(profileUserToAccessRoles)
    .innerJoin(
      profileUsers,
      eq(profileUserToAccessRoles.profileUserId, profileUsers.id),
    )
    .innerJoin(
      accessRoles,
      eq(profileUserToAccessRoles.accessRoleId, accessRoles.id),
    )
    .where(
      and(
        eq(profileUsers.profileId, profileId),
        eq(accessRoles.name, PUBLIC_PARTICIPANT_ROLE_NAME),
        isNull(accessRoles.profileId),
      ),
    )
    .limit(1);

  if (grant.length === 0) {
    return [];
  }

  const publicRole = await db.query.accessRoles.findFirst({
    where: {
      name: PUBLIC_PARTICIPANT_ROLE_NAME,
      profileId: { isNull: true },
    },
    with: {
      zonePermissions: {
        where: zonePermissionsWhere(profileId),
        with: {
          accessZone: true,
        },
      },
    },
  });

  return publicRole ? [{ accessRole: publicRole }] : [];
};

/**
 * Resolve the caller's *effective* normalized roles on a profile — their own
 * grant unioned with any public grant — without leaking the join-table identity
 * row. This is the honest shape for an access decision: roles are an aggregate
 * (own ∪ public), so they describe what the caller may do regardless of who
 * they are. Empty when no grant (own or public) matched, so `roles.length > 0`
 * is exactly the old `Boolean(getProfileAccessUser(...))` presence check.
 *
 * The caller's own grant is keyed on their own `authUserId` — identity is always
 * the requester, so there's no sentinel substitution and no synthetic identity
 * to fabricate for the anonymous-on-a-public-process case. The public grant is
 * detected by the Public Participant role (see
 * {@link getPublicParticipantRoleJunctions}), so this path doesn't go through
 * `resolveAccessUserIds`.
 *
 * No org fallback — for org-profile lookups that should fall back to org-level
 * grants, use {@link getProfileAccessRolesWithOrgFallback} instead.
 */
export const getProfileAccessRoles = memoize(
  async ({
    user,
    profileId,
  }: {
    user?: AccessUser;
    profileId: string;
  }): Promise<NormalizedRole[]> => {
    // Anonymous / no-JWT callers (and the public sentinel itself) have no "own"
    // grant — they get exactly the public roles below.
    const ownAuthUserId =
      user?.id && user.id !== GLOBAL_USER_PUBLIC ? user.id : undefined;

    const ownRow = ownAuthUserId
      ? await db.query.profileUsers.findFirst({
          where: {
            profileId,
            authUserId: ownAuthUserId,
          },
          with: {
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
        })
      : undefined;

    const publicRoleJunctions =
      await getPublicParticipantRoleJunctions(profileId);

    return getNormalizedRoles(
      [...(ownRow?.roles ?? []), ...publicRoleJunctions],
      { profileId },
    );
  },
  ({ profileId, user }) => `${profileId}:${user?.id ?? 'public'}`,
);

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
        console.error('Error converting lastOrgId to profileId:', error);
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
        console.error('Migration error:', migrationError);
        // Continue with the original user object if migration fails
      }
    }

    return { user: dbUser };
  },
  ({ authUserId }) => authUserId,
);

export * from './assertProfileTypeAccess';
export * from './getRoles';
export * from './permissions';
export * from './requestCache';
export * from './utils';
export * from './platformAdmin';
