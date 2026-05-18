import { db, eq } from '@op/db/client';
import { posts, postsToOrganizations, postsToProfiles } from '@op/db/schema';
import type { User } from '@supabase/supabase-js';
import { checkPermission, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
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
    throw new NotFoundError('Post', postId);
  }

  if (post.profileId && post.profileId === currentProfileId) {
    await db.delete(posts).where(eq(posts.id, postId));
    return;
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

// Legacy org-linked posts: createPostInOrganization does not set
// posts.profileId, so the author check above can't fire for them. Require
// org admin (not just membership) to keep the policy symmetric with
// profile-linked posts.
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
