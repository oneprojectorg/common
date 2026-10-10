import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import {
  getCurrentProfileId,
  getProfileAccessRolesWithOrgFallback,
} from '../access';
import { hasActiveModerationFlag } from '../moderation/moderationVisibility';
import { assertPostReadAccess } from '../posts/access';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';
import type { PostTranslation } from './translatePosts';

/**
 * Translates one decision-domain post's `content` — a proposal comment, a
 * reply, or a decision update. Authorizes through `assertPostReadAccess` on
 * every profile the post is linked to (the same gate `listProposalComments`
 * and `listProfilePosts` read through), then applies the moderation rule
 * those feeds apply: a flagged post is readable only by its author and the
 * decision's admins. Shares the `post:${id}:content` cache key with
 * `translatePosts`.
 */
export async function translatePost({
  postId,
  targetLocale,
  user,
}: {
  postId: string;
  targetLocale: SupportedLocale;
  user: User | undefined;
}): Promise<
  PostTranslation & {
    sourceLocale: string;
    targetLocale: SupportedLocale;
  }
> {
  const post = await db.query.posts.findFirst({
    where: { id: postId },
    columns: { id: true, content: true, profileId: true },
    with: { postsToProfiles: { columns: { profileId: true } } },
  });

  if (!post) {
    throw new NotFoundError('Post', postId);
  }

  // Fail closed: a post with no profile link (e.g. a legacy org-feed post) is
  // outside the surfaces this endpoint serves.
  if (post.postsToProfiles.length === 0) {
    throw new UnauthorizedError('You do not have access to this post');
  }

  const accessUser = user ? { id: user.id } : undefined;
  const readAccesses = await Promise.all(
    post.postsToProfiles.map(({ profileId }) =>
      assertPostReadAccess({ user: accessUser, profileId }),
    ),
  );

  if (await hasActiveModerationFlag('post', post.id)) {
    const actorProfileId = user ? await getCurrentProfileId(user.id) : null;
    const isAuthor = actorProfileId === post.profileId;

    if (!isAuthor) {
      const moderationRoles = await Promise.all(
        readAccesses.map(({ moderationProfileId }) =>
          getProfileAccessRolesWithOrgFallback({
            user: accessUser,
            profileId: moderationProfileId,
          }),
        ),
      );
      const isModerator = moderationRoles.every((roles) =>
        checkPermission({ profile: permission.ADMIN }, roles),
      );

      // Same as a missing post, so a flagged post's existence doesn't leak —
      // matches `getPost`.
      if (!isModerator) {
        throw new NotFoundError('Post', postId);
      }
    }
  }

  if (!post.content) {
    return { content: undefined, sourceLocale: '', targetLocale };
  }

  const [result] = await runTranslateBatch(
    [{ contentKey: `post:${post.id}:content`, text: post.content }],
    targetLocale,
  );

  return {
    content: result?.translatedText,
    sourceLocale: result?.sourceLocale ?? '',
    targetLocale,
  };
}
