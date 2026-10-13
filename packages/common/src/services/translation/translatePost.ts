import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import { hasActiveModerationFlag } from '../moderation/moderationVisibility';
import {
  assertCanReadFlaggedPost,
  assertPostReadAccessForPost,
} from '../posts/access';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';

/** Translates one comment, decision update or org-feed post for a reader who can see it. */
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
    columns: {
      id: true,
      content: true,
      profileId: true,
      parentPostId: true,
      rootPostId: true,
    },
    with: { postsToProfiles: { columns: { profileId: true } } },
  });

  if (!post) {
    throw new NotFoundError('Post', postId);
  }

  const { moderationProfileIds } = await assertPostReadAccessForPost({
    user: user ? { id: user.id } : undefined,
    post,
  });

  if (await hasActiveModerationFlag('post', post.id)) {
    await assertCanReadFlaggedPost({ post, user, moderationProfileIds });
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
