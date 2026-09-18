import { and, db, eq, or, sql } from '@op/db/client';
import { contentTranslations } from '@op/db/schema';

import { hashContent } from './hashContent';
import type { TranslationFormat, TranslationProvider } from './providers';

export type TranslatableEntry = {
  /** Identifies the content source, e.g. "proposal:abc123:default" */
  contentKey: string;
  /** The source text (plain text or HTML) */
  text: string;
  /**
   * How the provider should treat the text. Defaults to `html` because most
   * entries are rich-text fragments; pass `text` for bare strings (titles,
   * categories, field labels) or DeepL returns them wrapped in a `<p>`.
   */
  format?: TranslationFormat;
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
 * 3. Call the translation provider for cache misses
 * 4. Write new translations to cache
 * 5. Return results in the same order as input
 */
export async function translateBatch({
  entries,
  targetLocale,
  provider,
}: {
  entries: TranslatableEntry[];
  targetLocale: string;
  provider: TranslationProvider;
}): Promise<TranslationResult[]> {
  if (entries.length === 0) {
    return [];
  }

  const hashed = entries.map((entry) => ({
    ...entry,
    hash: hashContent(entry.text, entry.format ?? 'html'),
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
      provider,
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

/** Call the translation provider for entries that had no cache hit. */
async function translateCacheMisses(
  misses: HashedEntry[],
  targetLocale: string,
  provider: TranslationProvider,
): Promise<FreshTranslation[]> {
  const results = await provider.translate(
    misses.map((m) => ({ text: m.text, format: m.format ?? 'html' })),
  );

  return results.map((result, i) => {
    const miss = misses[i];
    if (!miss) {
      throw new Error(
        `Translation provider returned more results than entries — index ${i} out of bounds.`,
      );
    }
    return {
      contentKey: miss.contentKey,
      contentHash: miss.hash,
      sourceLocale: result.detectedSourceLang,
      targetLocale,
      translatedText: result.translatedText,
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
