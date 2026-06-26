import { db } from '@op/db/client';
import {
  resourceCollectionItems,
  resourceCollectionProfiles,
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

// Cap the per-call resource count. A decision usually has well under 40
// resources, so this covers the typical case without paying DeepL to
// translate the tail of an unusually long collection list.
const MAX_RESOURCES_PER_BATCH = 40;

/**
 * Translates the `title` and `description` of every resource attached to any
 * collection on the decision profile, via DeepL with cache-through semantics.
 * Authorizes once on the profile with `decisions: READ`, matching how the
 * resources tab gates its list endpoints. Ordered by `(collection sortKey,
 * item sortKey)` so the translated slice matches the order the resources tab
 * renders.
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

  // Walk profile → collections → resource-items in one ordered query, then
  // dedup by resourceId in JS (a resource can sit in more than one of the
  // profile's collections; we keep the first / smallest-sortKey occurrence).
  const rows = await db
    .select({ resourceId: resourceCollectionItems.resourceId })
    .from(resourceCollectionProfiles)
    .innerJoin(
      resourceCollectionItems,
      eq(
        resourceCollectionItems.collectionId,
        resourceCollectionProfiles.collectionId,
      ),
    )
    .where(eq(resourceCollectionProfiles.profileId, profileId))
    .orderBy(
      asc(resourceCollectionProfiles.sortKey),
      asc(resourceCollectionItems.sortKey),
    );

  const seen = new Set<string>();
  const resourceIds: string[] = [];
  for (const row of rows) {
    if (seen.has(row.resourceId)) {
      continue;
    }
    seen.add(row.resourceId);
    resourceIds.push(row.resourceId);
    if (resourceIds.length >= MAX_RESOURCES_PER_BATCH) {
      break;
    }
  }

  if (resourceIds.length === 0) {
    return { translations: {}, sourceLocale: '', targetLocale };
  }

  const resourceRows = await db
    .select({
      id: resourcesTable.id,
      title: resourcesTable.title,
      description: resourcesTable.description,
    })
    .from(resourcesTable)
    .where(inArray(resourcesTable.id, resourceIds));

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
