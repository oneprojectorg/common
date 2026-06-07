import { GLOBAL_USER_PUBLIC } from '@op/core';
import { type DbClient, db as defaultDb } from '@op/db/client';
import { profileUserToAccessRoles, profileUsers } from '@op/db/schema';

import { CommonError } from '../../utils';
import { getProfileAccessUser } from '../access';
import { assertGlobalRole } from '../assert';
import { updateDecisionRoles } from './decisionRoles';
import type { DecisionRolePermissions } from './permissions';

/**
 * The seeded global role through which all public participation flows. Its
 * global permission rows are a read-only baseline; what the public may do on
 * a specific profile comes from per-profile override rows on this role.
 */
export const PUBLIC_ROLE_NAME = 'Public';

/**
 * Configures what the public may do on a profile (decision instance):
 *
 * 1. writes the per-profile override row on the global `Public` role for the
 *    decisions zone — the role's global rows stay read-only, so the grant
 *    never leaks to other profiles, and
 * 2. grants the `Public` role to the {@link GLOBAL_USER_PUBLIC} sentinel on
 *    the profile, so no-JWT and non-member callers resolve it through the
 *    access layer's public-grant union.
 *
 * There is no separate "is public" flag to keep in sync: an instance is open
 * to public participation exactly when the public's effective decisions
 * permission for its profile carries a participation bit. Idempotent.
 */
export async function setPublicParticipation({
  profileId,
  permissions,
  user,
  db = defaultDb,
}: {
  profileId: string;
  permissions: DecisionRolePermissions;
  user: { id: string };
  db?: DbClient;
}) {
  const role = await assertGlobalRole(PUBLIC_ROLE_NAME, db);

  await updateDecisionRoles({
    roleId: role.id,
    decisionPermissions: permissions,
    user,
    profileId,
  });

  const existingProfileUser = await db.query.profileUsers.findFirst({
    where: { profileId, authUserId: GLOBAL_USER_PUBLIC },
  });

  let profileUserId = existingProfileUser?.id;

  if (!profileUserId) {
    const [createdProfileUser] = await db
      .insert(profileUsers)
      .values({
        profileId,
        authUserId: GLOBAL_USER_PUBLIC,
        email: null,
      })
      .returning();

    if (!createdProfileUser) {
      throw new CommonError('Failed to create public profile user');
    }

    profileUserId = createdProfileUser.id;
  }

  await db
    .insert(profileUserToAccessRoles)
    .values({ profileUserId, accessRoleId: role.id })
    .onConflictDoNothing();

  // Make the new public grant visible to subsequent access checks in this
  // request (the no-JWT identity resolves through the same memo).
  getProfileAccessUser.invalidate({ profileId });

  return { roleId: role.id, profileId, permissions };
}
