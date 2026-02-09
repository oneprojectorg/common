import { and, db, eq, or, sql } from '@op/db/client';
import { contentTranslations } from '@op/db/schema';
import type { DeepLClient, TargetLanguageCode } from 'deepl-node';

import { hashContent } from './hashContent';

export type TranslatableEntry = {
  /** Identifies the content source, e.g. "proposal:abc123:default" */
  contentKey: string;
  /** The source text (plain text or HTML) */
  text: string;
};

export type TranslationResult = {
  contentKey: string;
  translatedText: string;
  sourceLocale: string;
  cached: boolean;
};

type HashedEntry = TranslatableEntry & { hash: string };

/**
 * Translate a batch of text entries with cache-through semantics.
 *
 * 1. Hash each entry's source text
 * 2. Batch cache lookup
 * 3. Call DeepL for cache misses
 * 4. Write new translations to cache
 * 5. Return results in the same order as input
 */
export async function translateBatch({
  entries,
  targetLocale,
  client,
}: {
  entries: TranslatableEntry[];
  targetLocale: string;
  client: DeepLClient;
}): Promise<TranslationResult[]> {
  if (entries.length === 0) {
    return [];
  }

  const hashed = entries.map((entry) => ({
    ...entry,
    hash: hashContent(entry.text),
  }));

  const cacheHits = await lookupCached(hashed, targetLocale);

  const misses = hashed.filter(
    (entry) => !cacheHits.has(`${entry.contentKey}:${entry.hash}`),
  );

  let freshTranslations: FreshTranslation[] = [];
  if (misses.length > 0) {
    freshTranslations = await translateCacheMisses(
      misses,
      targetLocale,
      client,
    );
    await writeCacheEntries(freshTranslations);
  }

  return mergeResults(hashed, cacheHits, freshTranslations);
}

type FreshTranslation = {
  contentKey: string;
  contentHash: string;
  sourceLocale: string;
  targetLocale: string;
  translatedText: string;
};

/** Batch-fetch cached translations by composite (key, hash, locale). */
async function lookupCached(
  entries: HashedEntry[],
  targetLocale: string,
): Promise<Map<string, TranslationResult>> {
  const rows = await db
    .select()
    .from(contentTranslations)
    .where(
      or(
        ...entries.map((e) =>
          and(
            eq(contentTranslations.contentKey, e.contentKey),
            eq(contentTranslations.contentHash, e.hash),
            eq(contentTranslations.targetLocale, targetLocale),
          ),
        ),
      ),
    );

  return new Map(
    rows.map((row) => [
      `${row.contentKey}:${row.contentHash}`,
      {
        contentKey: row.contentKey,
        translatedText: row.translated,
        sourceLocale: row.sourceLocale ?? 'UNKNOWN',
        cached: true,
      },
    ]),
  );
}

/** Call DeepL for entries that had no cache hit. */
async function translateCacheMisses(
  misses: HashedEntry[],
  targetLocale: string,
  client: DeepLClient,
): Promise<FreshTranslation[]> {
  const texts = misses.map((m) => m.text);

  const deeplResults = await client.translateText(
    texts,
    null,
    targetLocale as TargetLanguageCode,
    { tagHandling: 'html' },
  );

  const results = Array.isArray(deeplResults) ? deeplResults : [deeplResults];

  return results.map((result, i) => {
    const miss = misses[i];
    if (!miss) {
      throw new Error(
        `DeepL returned more results than entries — index ${i} out of bounds.`,
      );
    }
    return {
      contentKey: miss.contentKey,
      contentHash: miss.hash,
      sourceLocale: result.detectedSourceLang.toUpperCase(),
      targetLocale,
      translatedText: result.text,
    };
  });
}

/** Upsert fresh translations into the cache table. */
async function writeCacheEntries(rows: FreshTranslation[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  await db
    .insert(contentTranslations)
    .values(
      rows.map((r) => ({
        contentKey: r.contentKey,
        contentHash: r.contentHash,
        sourceLocale: r.sourceLocale,
        targetLocale: r.targetLocale,
        translated: r.translatedText,
      })),
    )
    .onConflictDoUpdate({
      target: [
        contentTranslations.contentKey,
        contentTranslations.contentHash,
        contentTranslations.targetLocale,
      ],
      set: {
        translated: sql`excluded.translated`,
        sourceLocale: sql`excluded.source_locale`,
        updatedAt: sql`now()`,
      },
    });
}

/** Combine cached and fresh results, preserving input order. */
function mergeResults(
  entries: HashedEntry[],
  cacheHits: Map<string, TranslationResult>,
  freshTranslations: FreshTranslation[],
): TranslationResult[] {
  const freshMap = new Map(
    freshTranslations.map((t) => [
      `${t.contentKey}:${t.contentHash}`,
      {
        contentKey: t.contentKey,
        translatedText: t.translatedText,
        sourceLocale: t.sourceLocale,
        cached: false,
      },
    ]),
  );

  return entries.map((entry) => {
    const key = `${entry.contentKey}:${entry.hash}`;
    const result = cacheHits.get(key) ?? freshMap.get(key);

    if (!result) {
      throw new Error(
        `Translation result missing for key "${entry.contentKey}" — this is a bug.`,
      );
    }

    return result;
  });
}
