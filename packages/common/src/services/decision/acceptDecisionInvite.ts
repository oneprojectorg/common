import { db, eq } from '@op/db/client';
import {
  profileInvites,
  profileUserToAccessRoles,
  profileUsers,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import {
  CommonError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../../utils/error';
import { assertProfileBySlug } from '../assert';

export const acceptDecisionInvite = async ({
  profileId,
  slug,
  user,
}: {
  profileId?: string;
  slug?: string;
  user: User;
}) => {
  const email = user.email;
  if (!email) {
    throw new UnauthorizedError('User must have an email address');
  }

  let resolvedProfileId = profileId;
  if (!resolvedProfileId) {
    if (!slug) {
      throw new CommonError('Either profileId or slug must be provided');
    }
    const profile = await assertProfileBySlug(slug);
    resolvedProfileId = profile.id;
  }

  const invite = await db.query.profileInvites.findFirst({
    where: {
      profileId: resolvedProfileId,
      email: email.toLowerCase(),
      acceptedOn: { isNull: true },
    },
  });

  if (!invite) {
    throw new NotFoundError('No pending invite found for this decision');
  }

  if (invite.acceptedOn) {
    throw new ConflictError('This invite has already been accepted');
  }

  const existingMembership = await db.query.profileUsers.findFirst({
    where: { profileId: invite.profileId, authUserId: user.id },
  });

  if (existingMembership) {
    throw new CommonError('You are already a member of this profile');
  }

  const profileUser = await db.transaction(async (tx) => {
    const [newProfileUser] = await tx
      .insert(profileUsers)
      .values({
        authUserId: user.id,
        profileId: invite.profileId,
        email,
      })
      .returning();

    if (!newProfileUser) {
      throw new CommonError('Failed to create profile user');
    }

    await Promise.all([
      tx.insert(profileUserToAccessRoles).values({
        profileUserId: newProfileUser.id,
        accessRoleId: invite.accessRoleId,
      }),
      tx
        .update(profileInvites)
        .set({ acceptedOn: new Date().toISOString() })
        .where(eq(profileInvites.id, invite.id)),
    ]);

    return newProfileUser;
  });

  return { profileUser };
};
