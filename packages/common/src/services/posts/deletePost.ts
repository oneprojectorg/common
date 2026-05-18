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

  const [post] = await db
    .select({ id: posts.id, profileId: posts.profileId })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post) {
    throw new NotFoundError('Post', postId);
  }

  const currentProfileId = await getCurrentProfileId(user.id);

  let authorized =
    post.profileId !== null && post.profileId === currentProfileId;

  if (!authorized) {
    const profileLinks = await db
      .select({ profileId: postsToProfiles.profileId })
      .from(postsToProfiles)
      .where(eq(postsToProfiles.postId, postId));

    for (const { profileId } of profileLinks) {
      const profileUser = await getProfileAccessUser({ user, profileId });
      if (
        checkPermission({ profile: permission.ADMIN }, profileUser?.roles ?? [])
      ) {
        authorized = true;
        break;
      }
    }
  }

  if (!authorized) {
    const orgLinks = await db
      .select({ organizationId: postsToOrganizations.organizationId })
      .from(postsToOrganizations)
      .where(eq(postsToOrganizations.postId, postId));

    for (const { organizationId } of orgLinks) {
      const orgUser = await getOrgAccessUser({ organizationId, user });
      if (orgUser) {
        authorized = true;
        break;
      }
    }
  }

  if (!authorized) {
    throw new UnauthorizedError();
  }

  await db.delete(posts).where(eq(posts.id, postId));
};
