import { type DbClient, db as defaultDb } from '@op/db/client';
import { profileUserToAccessRoles, profileUsers } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { getProfileAccessUser } from '../access';
import { assertGlobalRole } from '../assert';
import type { ProfileUserBase } from '../profile/schemas/profileUser';
import { getDecisionRole } from './decisionRoles';
import type { DecisionRolePermissions } from './permissions';
import { PUBLIC_ROLE_NAME } from './publicParticipation';

export type JoinInstanceResult = {
  profileUser: ProfileUserBase;
  /** `true` when this call created the membership; `false` if already a member. */
  joined: boolean;
};

/**
 * Ensures `user` is a member of a public decision instance, granting the
 * global `Public` role to genuine non-members (anonymous sessions and
 * logged-in non-members alike). Joining is gated on the Public role itself,
 * resolved for this profile: the role the joiner is about to receive must
 * already carry `requiredPermission` — the capability the caller is about to
 * exercise (e.g. submit proposals, vote), since each instance configures its
 * own idea of public participation via {@link setPublicParticipation}'s
 * per-profile override rows. Joining never grants more than the public
 * already has. Idempotent and never escalates existing members. Reusable
 * server-side precondition for public actions.
 */
export async function joinInstance({
  processInstanceId,
  user,
  requiredPermission,
  db = defaultDb,
}: {
  processInstanceId: string;
  user: User;
  /** The decisions-zone capability the Public role must grant on the instance's profile for this join to be allowed. */
  requiredPermission: keyof DecisionRolePermissions;
  db?: DbClient;
}): Promise<JoinInstanceResult> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
  });

  if (!instance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  if (!instance.profileId) {
    throw new NotFoundError('Process instance', instance.id);
  }
  const profileId = instance.profileId;

  const result = await db.transaction(async (tx) => {
    const existingProfileUser = await tx.query.profileUsers.findFirst({
      where: { profileId, authUserId: user.id },
    });

    // Already a member — leave existing roles untouched.
    if (existingProfileUser) {
      return { profileUser: existingProfileUser, joined: false };
    }

    // Non-members may only join to do something the instance has opened to
    // the public: the Public role — the role this join grants — resolved for
    // this profile (per-profile override row over the read-only global
    // baseline) must carry the capability the caller is about to exercise.
    // Checking the role's effective permissions (not its mere existence or a
    // sentinel grant) is deliberate: the sentinel holding the Public role
    // only means the instance is publicly *readable*.
    const role = await assertGlobalRole(PUBLIC_ROLE_NAME, tx);
    const publicPermissions = await getDecisionRole({
      roleId: role.id,
      profileId,
    });

    if (!publicPermissions[requiredPermission]) {
      throw new UnauthorizedError("You don't have access to do this");
    }

    const [createdProfileUser] = await tx
      .insert(profileUsers)
      .values({
        profileId,
        authUserId: user.id,
        email: user.email ?? null,
      })
      .returning();

    if (!createdProfileUser) {
      throw new CommonError('Failed to create profile user');
    }

    await tx.insert(profileUserToAccessRoles).values({
      profileUserId: createdProfileUser.id,
      accessRoleId: role.id,
    });

    return { profileUser: createdProfileUser, joined: true };
  });

  if (result.joined) {
    // Make the new membership visible to the next access check in this request,
    // so a join-then-create can't read a stale non-member from the memo.
    getProfileAccessUser.invalidate({ user: { id: user.id }, profileId });
  }

  return result;
}
