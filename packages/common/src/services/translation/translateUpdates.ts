import { db } from '@op/db/client';
import { posts as postsTable, postsToProfiles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import type { TranslatableEntry } from '@op/translation';
import { and, eq, isNull } from 'drizzle-orm';

import { assertPostReadAccess } from '../posts/access';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';

export type UpdateTranslation = {
  content?: string;
};

/**
 * Translates the body of every top-level update post attached to a decision
 * profile into the target locale. Mirrors the `translateProposals` shape — one
 * entry per post, returned keyed by post id — so the client can swap rendered
 * post content without re-fetching the feed.
 */
export async function translateUpdates({
  decisionProfileId,
  targetLocale,
  user,
}: {
  decisionProfileId: string;
  targetLocale: SupportedLocale;
  user: User | undefined;
}): Promise<{
  translations: Record<string, UpdateTranslation>;
  sourceLocale: string;
  targetLocale: SupportedLocale;
}> {
  await assertPostReadAccess({ user, profileId: decisionProfileId });

  const rows = await db
    .select({ id: postsTable.id, content: postsTable.content })
    .from(postsToProfiles)
    .innerJoin(
      postsTable,
      and(
        eq(postsTable.id, postsToProfiles.postId),
        isNull(postsTable.parentPostId),
      ),
    )
    .where(eq(postsToProfiles.profileId, decisionProfileId));

  const entries: TranslatableEntry[] = [];
  for (const row of rows) {
    if (row.content) {
      entries.push({
        contentKey: `update:${row.id}:content`,
        text: row.content,
      });
    }
  }

  if (entries.length === 0) {
    return { translations: {}, sourceLocale: '', targetLocale };
  }

  const results = await runTranslateBatch(entries, targetLocale);

  const translations: Record<string, UpdateTranslation> = {};
  let sourceLocale = '';

  for (const result of results) {
    const parts = result.contentKey.split(':');
    if (parts.length !== 3 || parts[0] !== 'update' || parts[2] !== 'content') {
      continue;
    }
    const postId = parts[1];
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
