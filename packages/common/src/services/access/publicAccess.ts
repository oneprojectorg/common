import { invalidate } from '@op/cache';
import { GLOBAL_USER_PUBLIC } from '@op/core';
import { db } from '@op/db/client';
import {
  EntityType,
  accessRolePermissionsOnAccessZones,
  organizations,
  profileUserToAccessRoles,
  profileUsers,
} from '@op/db/schema';
import { permission } from 'access-zones';
import { and, eq } from 'drizzle-orm';

import { CommonError, NotFoundError } from '../../utils';
import { assertOrgAccess, assertProfileAdmin } from '../assert';
import { decisionPermission } from '../decision/permissions';
import { profileUserCacheKey } from './cacheKeys';
import { PUBLIC_ROLE_NAME } from './publicGrant';

/**
 * What the public may do on a profile, by what the profile is.
 *
 * A decision opens for reading. It does not open for proposal submission. A
 * caller who holds no account cannot be identified, moderated, or held to a
 * submission limit, so someone who wants to propose signs in first, with an
 * email address or a phone number.
 *
 * `SUBMIT_PROPOSALS` is not only the proposal bit. Five gates read it —
 * `createProposal`, `submitProposal`, `assertProposalEngagementAccess`, the
 * post-write gate in `services/posts/access.ts`, and `toggleLike`. Only the
 * two proposal gates change here. Commenting, liking and following sit on a
 * procedure tier that already refuses an anonymous session
 * (`authenticatedConfirmedProcedure` for a post, `networkAuthenticatedProcedure`
 * for a like or a follow), so this grant never admitted a visitor to them.
 * Withholding the bit affects those three only for a caller who holds an
 * account but no role on the decision, and who was relying on this grant to
 * supply it.
 *
 * So a public grant buys reading, and nothing else.
 *
 * The grant carries `VOTE`, which `submitVote` does not yet honour — it sits
 * on `networkAuthenticatedProcedure` and admits network members only. Read
 * `rolesIncludePublicGrant`, never a capability bit, to ask whether a profile
 * is open.
 *
 * An organization opens for reading only — nothing about an org profile is a
 * participatory surface.
 *
 * Every case carries `profile: READ`, matching the invariant `createRole`
 * enforces for scoped roles. Without it the public holds a decision grant on a
 * profile it cannot read.
 */
type PublicGrant = { zoneName: string; permission: number };

/**
 * `enumToPgEnum` widens every pgEnum column to `string`, so this switches on
 * the value rather than indexing a keyed record — no cast, and an unlisted
 * profile type answers `undefined` instead of an unchecked lookup.
 */
const publicGrantsFor = (type: string): PublicGrant[] | undefined => {
  switch (type) {
    case EntityType.DECISION:
      return [
        { zoneName: 'profile', permission: permission.READ },
        {
          zoneName: 'decisions',
          permission: permission.READ | decisionPermission.VOTE,
        },
      ];
    case EntityType.ORG:
      return [{ zoneName: 'profile', permission: permission.READ }];
    default:
      return undefined;
  }
};

/**
 * Asserts the caller may open or close public access on a profile.
 *
 * An organization is asked about through `assertOrgAccess`, not
 * `assertProfileAdmin`. Two reasons, and either alone is enough:
 *
 * - An org's grants live on `organizationUsers`. A `profileUsers` lookup on its
 *   profile never sees the org's own admin, so the profile-level check refuses
 *   the very person who runs the organization.
 * - `getProfileAccessUser` unions the public sentinel's grant into every
 *   caller's roles. Once a profile is public it always matches a row, which
 *   shadows the org fallback — so an org opened once could never be closed.
 *
 * A decision keeps the profile-level check. Its admins hold real
 * `profileUsers` rows, and the union only adds the Public role's read, so a
 * stranger still fails and a real admin still passes.
 */
const assertMayChangePublicAccess = async ({
  user,
  profileId,
  type,
}: {
  user: { id: string };
  profileId: string;
  type: string;
}): Promise<void> => {
  if (type !== EntityType.ORG) {
    await assertProfileAdmin({ user, profileId });
    return;
  }

  const [organization] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.profileId, profileId));

  if (!organization) {
    throw new NotFoundError('Organization', profileId);
  }

  await assertOrgAccess({
    user,
    organizationId: organization.id,
    permissions: { profile: permission.ADMIN },
  });
};

/**
 * Opens a profile to everyone — members, logged-in non-members, anonymous
 * sessions and no-JWT visitors alike.
 *
 * A grant is three rows: a `profileUsers` row for the {@link
 * GLOBAL_USER_PUBLIC} sentinel, a link to the global `Public` role, and one
 * per-profile permission override per zone. `resolveAccessUserIds` unions the
 * sentinel into every caller's lookup, so the override — and nothing else —
 * decides what a visitor may do. The `Public` role carries no permissions of
 * its own, so a grant can never widen past the profile it names.
 *
 * Idempotent: calling it again re-applies the same permissions.
 *
 * Caching caveat: the `profileUser` entry is keyed by the caller's resolved id
 * set, so an authenticated caller who was refused before this ran keeps that
 * answer until the entry expires. The sentinel's own key is invalidated here,
 * which covers every no-JWT visitor at once. There is no prefix invalidation to
 * reach the rest.
 *
 * @param profileId - The profile to open. Its `type` decides the grant.
 * @param user - The caller, who must be an admin of that profile.
 */
export async function makeProfilePublic({
  profileId,
  user,
}: {
  profileId: string;
  user: { id: string };
}): Promise<void> {
  const profile = await db.query.profiles.findFirst({
    where: { id: profileId },
    columns: { id: true, type: true },
  });

  if (!profile) {
    throw new NotFoundError('Profile', profileId);
  }

  await assertMayChangePublicAccess({ user, profileId, type: profile.type });

  const grants = publicGrantsFor(profile.type);

  if (!grants) {
    throw new CommonError(`A ${profile.type} profile cannot be made public`);
  }

  const role = await db.query.accessRoles.findFirst({
    where: { name: PUBLIC_ROLE_NAME, profileId: { isNull: true } },
  });

  if (!role) {
    throw new NotFoundError('Role', PUBLIC_ROLE_NAME);
  }

  const zones = await db.query.accessZones.findMany({
    where: { name: { in: grants.map((grant) => grant.zoneName) } },
  });

  await db.transaction(async (tx) => {
    // No unique index covers (profileId, authUserId), so the read decides
    // whether to insert. Two admins opening the same profile at once would
    // leave a duplicate membership row; both carry the same role, so the grant
    // it produces is the same either way.
    const existing = await tx.query.profileUsers.findFirst({
      where: { profileId, authUserId: GLOBAL_USER_PUBLIC },
      columns: { id: true },
    });

    const profileUserId =
      existing?.id ??
      (
        await tx
          .insert(profileUsers)
          .values({ profileId, authUserId: GLOBAL_USER_PUBLIC })
          .returning({ id: profileUsers.id })
      )[0]?.id;

    if (!profileUserId) {
      throw new CommonError('Could not create the public membership');
    }

    await tx
      .insert(profileUserToAccessRoles)
      .values({ profileUserId, accessRoleId: role.id })
      .onConflictDoNothing();

    for (const grant of grants) {
      const zone = zones.find((candidate) => candidate.name === grant.zoneName);

      if (!zone) {
        throw new NotFoundError('Zone', grant.zoneName);
      }

      await tx
        .insert(accessRolePermissionsOnAccessZones)
        .values({
          accessRoleId: role.id,
          accessZoneId: zone.id,
          permission: grant.permission,
          profileId,
        })
        .onConflictDoUpdate({
          target: [
            accessRolePermissionsOnAccessZones.accessRoleId,
            accessRolePermissionsOnAccessZones.accessZoneId,
            accessRolePermissionsOnAccessZones.profileId,
          ],
          set: { permission: grant.permission },
        });
    }
  });

  await invalidatePublicGrant(profileId);
}

/**
 * Closes a profile the public could reach.
 *
 * Removes the membership row, which cascades to its role link, and the
 * per-profile overrides. The global `Public` role is left alone — it is shared
 * by every public profile, and it holds no permissions of its own.
 *
 * The same caching caveat as {@link makeProfilePublic} applies in reverse: a
 * visitor already holding a cached answer keeps it until the entry expires, so
 * this is not a way to revoke access urgently.
 */
export async function revokeProfilePublicAccess({
  profileId,
  user,
}: {
  profileId: string;
  user: { id: string };
}): Promise<void> {
  const profile = await db.query.profiles.findFirst({
    where: { id: profileId },
    columns: { id: true, type: true },
  });

  if (!profile) {
    throw new NotFoundError('Profile', profileId);
  }

  await assertMayChangePublicAccess({ user, profileId, type: profile.type });

  const role = await db.query.accessRoles.findFirst({
    where: { name: PUBLIC_ROLE_NAME, profileId: { isNull: true } },
  });

  if (!role) {
    throw new NotFoundError('Role', PUBLIC_ROLE_NAME);
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(profileUsers)
      .where(
        and(
          eq(profileUsers.profileId, profileId),
          eq(profileUsers.authUserId, GLOBAL_USER_PUBLIC),
        ),
      );

    await tx
      .delete(accessRolePermissionsOnAccessZones)
      .where(
        and(
          eq(accessRolePermissionsOnAccessZones.accessRoleId, role.id),
          eq(accessRolePermissionsOnAccessZones.profileId, profileId),
        ),
      );
  });

  await invalidatePublicGrant(profileId);
}

/** Whether the public holds a grant on a profile. */
export async function isProfilePublic(profileId: string): Promise<boolean> {
  const row = await db.query.profileUsers.findFirst({
    where: { profileId, authUserId: GLOBAL_USER_PUBLIC },
    columns: { id: true },
  });

  return Boolean(row);
}

const invalidatePublicGrant = async (profileId: string) =>
  invalidate({
    type: 'profileUser',
    params: profileUserCacheKey({
      user: { id: GLOBAL_USER_PUBLIC },
      profileId,
    }),
  });
