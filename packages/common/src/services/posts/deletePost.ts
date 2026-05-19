import { db, eq } from '@op/db/client';
import { posts, postsToOrganizations, postsToProfiles } from '@op/db/schema';
import type { User } from '@supabase/supabase-js';
import { checkPermission, permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import {
  getCurrentProfileId,
  getOrgAccessUser,
  getProfileAccessUser,
} from '../access';

export interface DeletePostByIdOptions {
  postId: string;
  user: User;
}

export const deletePostById = async (options: DeletePostByIdOptions) => {
  const { postId, user } = options;

  const [[post], currentProfileId] = await Promise.all([
    db
      .select({
        id: posts.id,
        profileId: posts.profileId,
        rootProfileId: posts.rootProfileId,
      })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1),
    getCurrentProfileId(user.id),
  ]);

  if (!post) {
    // Mirror the unauthorized branch to avoid leaking post existence to
    // outsiders who guess IDs.
    throw new UnauthorizedError();
  }

  // Author fast-path: the actor's current profile matches the post's
  // recorded profileId. The currentProfileId match alone is NOT sufficient —
  // `account.switchOrganization` only requires org membership, so any member
  // can land on `currentProfileId = orgProfileId`. We additionally require a
  // `profileUsers` row on that profile, which org members never have (orgs
  // grant access via `organizationUsers`). Individual profiles and decision
  // instance profiles do issue `profileUsers` rows to their authors, so this
  // preserves the legitimate self-delete path.
  if (post.profileId && post.profileId === currentProfileId) {
    const profileUser = await getProfileAccessUser({
      user,
      profileId: post.profileId,
    });
    if (profileUser) {
      await db.delete(posts).where(eq(posts.id, postId));
      return;
    }
  }

  const [isProfileAdmin, isOrgAdmin] = await Promise.all([
    checkProfileAdmin({
      user,
      postId,
      rootProfileId: post.rootProfileId,
    }),
    checkOrgAdmin({ user, postId }),
  ]);

  if (!isProfileAdmin && !isOrgAdmin) {
    throw new UnauthorizedError();
  }

  await db.delete(posts).where(eq(posts.id, postId));
};

// Prefer the pinned rootProfileId gate (mirrors getPost). Fall back to the
// postsToProfiles index for legacy posts written before the gate was added.
const checkProfileAdmin = async ({
  user,
  postId,
  rootProfileId,
}: {
  user: User;
  postId: string;
  rootProfileId: string | null;
}): Promise<boolean> => {
  const profileIdsToCheck = rootProfileId
    ? [rootProfileId]
    : (
        await db
          .select({ profileId: postsToProfiles.profileId })
          .from(postsToProfiles)
          .where(eq(postsToProfiles.postId, postId))
      ).map((row) => row.profileId);

  if (profileIdsToCheck.length === 0) {
    return false;
  }

  const profileUsers = await Promise.all(
    profileIdsToCheck.map((profileId) =>
      getProfileAccessUser({ user, profileId }),
    ),
  );
  return profileUsers.some((profileUser) =>
    checkPermission({ profile: permission.ADMIN }, profileUser?.roles ?? []),
  );
};

// Legacy org-linked posts: only `createPostInOrganization` writes
// `postsToOrganizations` rows, and it never sets `posts.profileId`, so the
// fast-path above can't fire for them. (Posts created via `createPost` —
// including comments under those legacy posts — always have `profileId` set
// and never get a `postsToOrganizations` row, so they fall through to
// `checkProfileAdmin` instead.) Require org admin, not just membership, to
// stay symmetric with the profile-linked path.
const checkOrgAdmin = async ({
  user,
  postId,
}: {
  user: User;
  postId: string;
}): Promise<boolean> => {
  const orgLinks = await db
    .select({ organizationId: postsToOrganizations.organizationId })
    .from(postsToOrganizations)
    .where(eq(postsToOrganizations.postId, postId));

  if (orgLinks.length === 0) {
    return false;
  }

  const orgUsers = await Promise.all(
    orgLinks.map(({ organizationId }) =>
      getOrgAccessUser({ organizationId, user }),
    ),
  );
  return orgUsers.some((orgUser) =>
    checkPermission({ profile: permission.ADMIN }, orgUser?.roles ?? []),
  );
};
