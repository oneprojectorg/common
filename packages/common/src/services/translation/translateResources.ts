import { db } from '@op/db/client';
import {
  resourceCollectionItems,
  resourceCollectionProfiles,
  resources as resourcesTable,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import type { TranslatableEntry } from '@op/translation';
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

  // Translate via DeepL with cache-through. The response groups results by
  // `resource:<id>:<field>` content keys; bucket them per resource then
  // unflatten the same way `translateProposals` does.
  const results = await runTranslateBatch(entries, targetLocale);

  const translations: Record<string, ResourceTranslation> = {};
  const resultsByResourceId = new Map<string, typeof results>();
  let sourceLocale = '';

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
    const title = translated.title;
    const description = translated.description;
    translations[resourceId] = {
      title: typeof title === 'string' ? title : undefined,
      description: typeof description === 'string' ? description : undefined,
    };
  }

  return { translations, sourceLocale, targetLocale };
}
