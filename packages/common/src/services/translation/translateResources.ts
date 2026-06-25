import { db } from '@op/db/client';
import { EntityType } from '@op/db/schema';
import {
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
 * Translates the user-facing title + description of every resource attached to
 * a decision profile's collections. Returns translations keyed by resource id
 * so the client can swap rendered card text without re-fetching the list.
 */
export async function translateResources({
  decisionProfileId,
  targetLocale,
  user,
}: {
  decisionProfileId: string;
  targetLocale: SupportedLocale;
  user: User | undefined;
}): Promise<{
  translations: Record<string, ResourceTranslation>;
  sourceLocale: string;
  targetLocale: SupportedLocale;
}> {
  await assertProfileTypeAccess({
    user,
    profileIds: [decisionProfileId],
    policies: { [EntityType.DECISION]: { decisions: permission.READ } },
  });

  // The decision profile owns a set of collections; each collection holds a
  // set of resources. Resource translation is page-independent — we translate
  // every resource on the decision, not just the current page — so the join
  // stays flat instead of paginating per collection.
  const rows = await db
    .select({
      id: resources.id,
      title: resources.title,
      description: resources.description,
    })
    .from(resourceCollectionProfiles)
    .innerJoin(
      resourceCollectionItems,
      eq(
        resourceCollectionItems.collectionId,
        resourceCollectionProfiles.collectionId,
      ),
    )
    .innerJoin(resources, eq(resources.id, resourceCollectionItems.resourceId))
    .where(eq(resourceCollectionProfiles.profileId, decisionProfileId));

  const entries: TranslatableEntry[] = [];
  for (const row of rows) {
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

  for (const [resourceId, resourceResults] of resultsByResourceId) {
    translations[resourceId] = unflattenTranslatedFields(
      `resource:${resourceId}:`,
      resourceResults,
    ).translated as ResourceTranslation;
  }

  return { translations, sourceLocale, targetLocale };
}
