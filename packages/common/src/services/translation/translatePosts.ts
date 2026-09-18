import { db } from '@op/db/client';
import {
  EntityType,
  posts as postsTable,
  postsToProfiles,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import type { TranslatableEntry } from '@op/translation';
import { checkPermission, permission } from 'access-zones';
import { and, desc, eq, isNull } from 'drizzle-orm';

import { UnauthorizedError } from '../../utils';
import {
  assertProfileTypeAccess,
  getCurrentProfileId,
  getProfileAccessRolesWithOrgFallback,
} from '../access';
import { postModerationFilter } from '../posts/listPosts';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';

export type PostTranslation = {
  content?: string;
};

// Cap the number of posts a single translate call will batch. The side panel
// renders 20 per page, so 40 covers the two most recent pages — enough for
// the updates a translate-clicker is actually looking at without paying for
// DeepL on long historical tails.
const MAX_POSTS_PER_BATCH = 40;

/**
 * Translates the `content` of every top-level post attached to the decision
 * profile into the target locale. Authorizes once on the decision via
 * `decisions: READ`, mirroring how the side-panel feed (`listProfilePosts`)
 * is gated, and applies the same moderation filter so a non-admin caller
 * can't read translated content for a post they couldn't see in the feed.
 * Top-level only (comments are translated through their thread, not the
 * decision feed). Returns the newest `MAX_POSTS_PER_BATCH` posts so the
 * translated slice matches the feed's `desc(createdAt)` order.
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
  // Fail-closed gate identical to assertPostReadAccess's DECISION branch.
  // This endpoint only translates decision-profile feeds; anything else
  // (org / individual / proposal feed) is out of scope.
  const profile = await db.query.profiles.findFirst({
    where: { id: profileId },
    columns: { type: true },
  });
  if (!profile) {
    throw new UnauthorizedError('You do not have access to these posts');
  }
  if (profile.type !== EntityType.DECISION) {
    throw new UnauthorizedError('You do not have access to these posts');
  }
  await assertProfileTypeAccess({
    user: user ? { id: user.id } : undefined,
    profileIds: [profileId],
    policies: { [EntityType.DECISION]: { decisions: permission.READ } },
  });

  // Resolve the actor + their roles so the moderation filter can hide
  // flagged posts from non-admin non-author callers — same pattern as
  // listProfilePosts. Admins skip the filter entirely.
  const [actorProfileId, governingRoles] = await Promise.all([
    user ? getCurrentProfileId(user.id) : undefined,
    getProfileAccessRolesWithOrgFallback({
      user: user ? { id: user.id } : undefined,
      profileId,
    }),
  ]);
  const isProfileAdmin = checkPermission(
    { profile: permission.ADMIN },
    governingRoles,
  );

  // Top-level posts only, newest first to match the side-panel feed.
  const rows = await db
    .select({
      id: postsTable.id,
      content: postsTable.content,
    })
    .from(postsToProfiles)
    .innerJoin(
      postsTable,
      and(
        eq(postsTable.id, postsToProfiles.postId),
        isNull(postsTable.parentPostId),
        isProfileAdmin
          ? undefined
          : postModerationFilter(postsTable, actorProfileId),
      ),
    )
    .where(eq(postsToProfiles.profileId, profileId))
    .orderBy(desc(postsToProfiles.createdAt), desc(postsToProfiles.postId))
    .limit(MAX_POSTS_PER_BATCH);

  if (rows.length === 0) {
    return { translations: {}, sourceLocale: '', targetLocale };
  }

  const entries: TranslatableEntry[] = [];
  for (const row of rows) {
    if (!row.content) {
      continue;
    }
    entries.push({
      contentKey: `post:${row.id}:content`,
      text: row.content,
      format: 'text',
    });
  }

  if (entries.length === 0) {
    return { translations: {}, sourceLocale: '', targetLocale };
  }

  const results = await runTranslateBatch(entries, targetLocale);

  const translations: Record<string, PostTranslation> = {};
  let sourceLocale = '';

  for (const result of results) {
    const match = /^post:(?<postId>[^:]+):content$/.exec(result.contentKey);
    const postId = match?.groups?.postId;
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
