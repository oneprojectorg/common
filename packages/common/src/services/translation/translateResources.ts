import { db } from '@op/db/client';
import {
  resourceCollectionItems,
  resourceCollectionProfiles,
  resourceCollections,
  resources as resourcesTable,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import type { TranslatableEntry, TranslationResult } from '@op/translation';
import { permission } from 'access-zones';
import { asc, eq, inArray } from 'drizzle-orm';

import { assertProfileAccess } from '../assert';
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

// Cap the per-call resource count. A decision usually has well under 50
// resources; 200 leaves plenty of headroom while still bounding the DeepL
// batch size if someone unexpectedly piles them up.
const MAX_RESOURCES_PER_BATCH = 200;

/**
 * Translates the `title` and `description` of every resource attached to any
 * collection on the decision profile, via DeepL with cache-through semantics.
 * Authorizes once on the profile with `decisions: READ`, matching how the
 * resources tab gates its list endpoints. Ordered by `(collection sortKey,
 * item sortKey)` so the translated slice matches the order the resources
 * tab renders.
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
  await assertProfileAccess({
    user,
    profileId,
    permissions: { decisions: permission.READ },
  });

  // Walk the profile → collections → resource-items chain in a single ordered
  // query so the per-call cap is deterministic. The same resource can appear
  // in multiple collections; `selectDistinctOn(resourceId)` keeps it once and
  // takes the smallest `(collection sortKey, item sortKey)` pair.
  const rows = await db
    .selectDistinctOn([resourceCollectionItems.resourceId], {
      resourceId: resourceCollectionItems.resourceId,
      collectionSortKey: resourceCollectionProfiles.sortKey,
      itemSortKey: resourceCollectionItems.sortKey,
    })
    .from(resourceCollectionProfiles)
    .innerJoin(
      resourceCollections,
      eq(resourceCollections.id, resourceCollectionProfiles.collectionId),
    )
    .innerJoin(
      resourceCollectionItems,
      eq(resourceCollectionItems.collectionId, resourceCollections.id),
    )
    .where(eq(resourceCollectionProfiles.profileId, profileId))
    .orderBy(
      asc(resourceCollectionItems.resourceId),
      asc(resourceCollectionProfiles.sortKey),
      asc(resourceCollectionItems.sortKey),
    );

  if (rows.length === 0) {
    return { translations: {}, sourceLocale: '', targetLocale };
  }

  // Sort by the user-visible order ((collection, item) sortKey) then cap.
  rows.sort((a, b) => {
    if (a.collectionSortKey !== b.collectionSortKey) {
      return a.collectionSortKey < b.collectionSortKey ? -1 : 1;
    }
    return a.itemSortKey < b.itemSortKey ? -1 : 1;
  });

  const resourceIds = rows
    .map((row) => row.resourceId)
    .slice(0, MAX_RESOURCES_PER_BATCH);

  const resourceRows = await db
    .select({
      id: resourcesTable.id,
      title: resourcesTable.title,
      description: resourcesTable.description,
    })
    .from(resourcesTable)
    .where(inArray(resourcesTable.id, resourceIds));

  if (resourceRows.length === 0) {
    return { translations: {}, sourceLocale: '', targetLocale };
  }

  const entries: TranslatableEntry[] = [];
  for (const row of resourceRows) {
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

  return parseResults(results, targetLocale);
}

function parseResults(
  results: TranslationResult[],
  targetLocale: SupportedLocale,
): {
  translations: Record<string, ResourceTranslation>;
  sourceLocale: string;
  targetLocale: SupportedLocale;
} {
  const resultsByResource = new Map<string, TranslationResult[]>();
  let sourceLocale = '';

  for (const result of results) {
    const match = /^resource:(?<id>[^:]+):/.exec(result.contentKey);
    const resourceId = match?.groups?.id;
    if (!resourceId) {
      continue;
    }
    const bucket = resultsByResource.get(resourceId) ?? [];
    bucket.push(result);
    resultsByResource.set(resourceId, bucket);
    if (!sourceLocale && result.sourceLocale) {
      sourceLocale = result.sourceLocale;
    }
  }

  const translations: Record<string, ResourceTranslation> = {};
  for (const [resourceId, bucket] of resultsByResource) {
    const { translated } = unflattenTranslatedFields(
      `resource:${resourceId}:`,
      bucket,
    );
    const entry: ResourceTranslation = {};
    if (typeof translated.title === 'string') {
      entry.title = translated.title;
    }
    if (typeof translated.description === 'string') {
      entry.description = translated.description;
    }
    translations[resourceId] = entry;
  }

  return { translations, sourceLocale, targetLocale };
}
