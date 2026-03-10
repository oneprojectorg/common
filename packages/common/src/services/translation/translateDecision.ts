import { and, db, eq } from '@op/db/client';
import {
  EntityType,
  processInstances,
  profileUsers,
  profiles,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import type { TranslatableEntry } from '@op/translation';

import { NotFoundError, UnauthorizedError } from '../../utils';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';

/**
 * Translates a decision profile's header fields (name, description) into the
 * target locale via DeepL with cache-through semantics.
 */
export async function translateDecision({
  decisionProfileId,
  targetLocale,
  user,
}: {
  decisionProfileId: string;
  targetLocale: SupportedLocale;
  user: User;
}): Promise<{
  translated: Record<string, string>;
  sourceLocale: string;
  targetLocale: SupportedLocale;
}> {
  // Fetch decision profile + auth check + description in a single join
  const rows = await db
    .select({
      profileId: profiles.id,
      name: profiles.name,
      description: processInstances.description,
    })
    .from(profiles)
    .innerJoin(
      profileUsers,
      and(
        eq(profileUsers.profileId, profiles.id),
        eq(profileUsers.authUserId, user.id),
      ),
    )
    .innerJoin(processInstances, eq(processInstances.profileId, profiles.id))
    .where(
      and(
        eq(profiles.id, decisionProfileId),
        eq(profiles.type, EntityType.DECISION),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    throw new UnauthorizedError(
      'User does not have access to this decision profile',
    );
  }

  const row = rows[0];

  if (!row) {
    throw new NotFoundError('Decision profile not found');
  }

  const entries: TranslatableEntry[] = [];

  if (row.name) {
    entries.push({
      contentKey: `decision:${decisionProfileId}:name`,
      text: row.name,
    });
  }

  if (row.description) {
    entries.push({
      contentKey: `decision:${decisionProfileId}:description`,
      text: row.description,
    });
  }

  if (entries.length === 0) {
    return { translated: {}, sourceLocale: '', targetLocale };
  }

  const results = await runTranslateBatch(entries, targetLocale);

  const prefix = `decision:${decisionProfileId}:`;
  const translated: Record<string, string> = {};
  let sourceLocale = '';

  for (const result of results) {
    const fieldName = result.contentKey.startsWith(prefix)
      ? result.contentKey.slice(prefix.length)
      : result.contentKey;
    translated[fieldName] = result.translatedText;

    if (!sourceLocale && result.sourceLocale) {
      sourceLocale = result.sourceLocale;
    }
  }

  return { translated, sourceLocale, targetLocale };
}
