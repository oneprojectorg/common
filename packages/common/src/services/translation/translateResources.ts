import { db } from '@op/db/client';
import {
  EntityType,
  resourceCollectionItems,
  resourceCollectionProfiles,
  resources,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import type { TranslatableEntry } from '@op/translation';
import { permission } from 'access-zones';
import { eq } from 'drizzle-orm';

import { assertProfileTypeAccess } from '../access';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';
import {
  flattenTranslatableFields,
  unflattenTranslatedFields,
} from './translatedFields';

export type ResourceTranslation = {
  title?: string;
  description?: string;
};

/**
 * Translates the title and description of every resource attached to a
 * profile's collections (typically a decision profile's "Resources" tab) into
 * the target locale via DeepL with cache-through semantics.
 */
export async function translateResources({
  profileId,
  targetLocale,
  user,
}: {
  profileId: string;
  targetLocale: SupportedLocale;
  user: User | undefined;
}): Promise<{
  translations: Record<string, ResourceTranslation>;
  sourceLocale: string;
  targetLocale: SupportedLocale;
}> {
  // Translating the listing requires the same READ grant the list endpoint
  // applies; gate on decisions:READ at the decision profile (other profile
  // types don't currently expose this surface).
  await assertProfileTypeAccess({
    user: user ? { id: user.id } : undefined,
    profileIds: [profileId],
    policies: {
      [EntityType.DECISION]: { decisions: permission.READ },
    },
  });

  const rows = await db
    .select({
      id: resources.id,
      title: resources.title,
      description: resources.description,
    })
    .from(resources)
    .innerJoin(
      resourceCollectionItems,
      eq(resourceCollectionItems.resourceId, resources.id),
    )
    .innerJoin(
      resourceCollectionProfiles,
      eq(
        resourceCollectionProfiles.collectionId,
        resourceCollectionItems.collectionId,
      ),
    )
    .where(eq(resourceCollectionProfiles.profileId, profileId));

  // A resource can sit in multiple collections under the same profile — fold
  // by id so we translate each title/description exactly once per batch.
  const uniqueRows = new Map<
    string,
    { id: string; title: string | null; description: string | null }
  >();
  for (const row of rows) {
    if (!uniqueRows.has(row.id)) {
      uniqueRows.set(row.id, row);
    }
  }

  const entries: TranslatableEntry[] = [];
  for (const row of uniqueRows.values()) {
    entries.push(
      ...flattenTranslatableFields(`resource:${row.id}:`, {
        title: row.title,
        description: row.description,
      }),
    );
  }

  if (entries.length === 0) {
    return { translations: {}, sourceLocale: '', targetLocale };
  }

  const results = await runTranslateBatch(entries, targetLocale);

  const translations: Record<string, ResourceTranslation> = {};
  let sourceLocale = '';

  // Bucket results by resource id, then unflatten each bucket back into the
  // original `{ title?, description? }` shape via the shared helper.
  const resultsByResourceId = new Map<string, typeof results>();
  for (const result of results) {
    const parts = result.contentKey.split(':');
    if (parts.length < 3 || parts[0] !== 'resource') {
      continue;
    }
    const resourceId = parts[1];
    if (!resourceId) {
      continue;
    }
    const bucket = resultsByResourceId.get(resourceId) ?? [];
    bucket.push(result);
    resultsByResourceId.set(resourceId, bucket);

    if (!sourceLocale && result.sourceLocale) {
      sourceLocale = result.sourceLocale;
    }
  }

  for (const [resourceId, bucket] of resultsByResourceId) {
    const { translated } = unflattenTranslatedFields(
      `resource:${resourceId}:`,
      bucket,
    );
    translations[resourceId] = translated as ResourceTranslation;
  }

  return { translations, sourceLocale, targetLocale };
}
