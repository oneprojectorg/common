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

/** Translates one comment or decision update for readers of every profile it's linked to. */
export type PostTranslation = {
  content?: string;
};

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

  // A post outside any decision or proposal (e.g. an org-feed post) is refused.
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
    await assertCanReadFlaggedPost({
      post,
      user,
      moderationProfileIds: readAccesses.map(
        ({ moderationProfileId }) => moderationProfileId,
      ),
    });
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

/** A flagged post is NotFound to everyone but its author and the decision's admins. */
const assertCanReadFlaggedPost = async ({
  post,
  user,
  moderationProfileIds,
}: {
  post: { id: string; profileId: string | null };
  user: User | undefined;
  moderationProfileIds: string[];
}) => {
  const actorProfileId = user ? await getCurrentProfileId(user.id) : null;
  // No profile is nobody's author, even of a post with no recorded author.
  if (actorProfileId != null && actorProfileId === post.profileId) {
    return;
  }

  const accessUser = user ? { id: user.id } : undefined;
  const moderationRoles = await Promise.all(
    moderationProfileIds.map((profileId) =>
      getProfileAccessRolesWithOrgFallback({ user: accessUser, profileId }),
    ),
  );
  const isModerator = moderationRoles.every((roles) =>
    checkPermission({ profile: permission.ADMIN }, roles),
  );

  if (!isModerator) {
    throw new NotFoundError('Post', post.id);
  }
};
