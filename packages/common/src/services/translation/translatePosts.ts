import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import type { TranslatableEntry } from '@op/translation';

import { assertPostReadAccess } from '../posts/access';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';

export type PostTranslation = {
  content: string;
};

/**
 * Translates the content of every top-level post associated with a profile
 * (typically a decision profile's "Updates" feed) into the target locale via
 * DeepL with cache-through semantics.
 */
export async function translatePosts({
  profileId,
  targetLocale,
  user,
}: {
  profileId: string;
  targetLocale: SupportedLocale;
  user: User | undefined;
}): Promise<{
  translations: Record<string, PostTranslation>;
  sourceLocale: string;
  targetLocale: SupportedLocale;
}> {
  await assertPostReadAccess({ user, profileId });

  // Top-level posts only — comments are translated on demand alongside their
  // parent thread, not as part of the feed-level translate badge.
  const rows = await db.query.postsToProfiles.findMany({
    where: { profileId },
    with: {
      post: {
        columns: { id: true, content: true, parentPostId: true },
      },
    },
  });

  const entries: TranslatableEntry[] = [];
  for (const row of rows) {
    const post = row.post;
    if (!post || post.parentPostId !== null || !post.content) {
      continue;
    }
    entries.push({
      contentKey: `post:${post.id}:content`,
      text: post.content,
    });
  }

  if (entries.length === 0) {
    return { translations: {}, sourceLocale: '', targetLocale };
  }

  const results = await runTranslateBatch(entries, targetLocale);

  const translations: Record<string, PostTranslation> = {};
  let sourceLocale = '';

  for (const result of results) {
    const match = /^post:(?<id>[^:]+):content$/.exec(result.contentKey);
    const postId = match?.groups?.id;
    if (!postId) {
      continue;
    }
    translations[postId] = { content: result.translatedText };
    if (!sourceLocale && result.sourceLocale) {
      sourceLocale = result.sourceLocale;
    }
  }

  return { translations, sourceLocale, targetLocale };
}
