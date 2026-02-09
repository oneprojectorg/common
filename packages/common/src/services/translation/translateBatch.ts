import { and, db, eq, or, sql } from '@op/db/client';
import { contentTranslations } from '@op/db/schema';
import type { DeepLClient, TargetLanguageCode, TextResult } from 'deepl-node';

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
  sourceLocale: string | null;
  cached: boolean;
};

/**
 * Translate a batch of text entries with cache-through semantics.
 *
 * 1. Hash each entry's source text
 * 2. Batch cache lookup by (contentKey, contentHash, targetLocale)
 * 3. Call DeepL for cache misses (single API call for all misses)
 * 4. Write new translations to cache
 * 5. Return results in the same order as input entries
 */
export async function translateBatch({
  entries,
  targetLocale,
  client,
  tagHandling = 'html',
}: {
  entries: TranslatableEntry[];
  targetLocale: string;
  client: DeepLClient;
  tagHandling?: 'html' | 'xml';
}): Promise<TranslationResult[]> {
  if (entries.length === 0) {
    return [];
  }

  // 1. Hash each entry
  const hashed = entries.map((entry) => ({
    ...entry,
    hash: hashContent(entry.text),
  }));

  // 2. Batch cache lookup
  // Each condition matches a specific (contentKey, contentHash, targetLocale) triple.
  // Using or() with individual and() conditions ensures row-level composite matching.
  // Do NOT use separate inArray() calls — that creates a cross-product
  // (key1+hash2 would falsely match).
  const cached = await db
    .select()
    .from(contentTranslations)
    .where(
      or(
        ...hashed.map((h) =>
          and(
            eq(contentTranslations.contentKey, h.contentKey),
            eq(contentTranslations.contentHash, h.hash),
            eq(contentTranslations.targetLocale, targetLocale),
          ),
        ),
      ),
    );

  // Build lookup map: "contentKey:contentHash" → cached row
  const cacheMap = new Map(
    cached.map((row) => [`${row.contentKey}:${row.contentHash}`, row]),
  );

  // 3. Separate hits from misses
  const results: (TranslationResult | null)[] = new Array(hashed.length).fill(
    null,
  );
  const misses: Array<{
    originalIndex: number;
    entry: (typeof hashed)[number];
  }> = [];

  for (const [i, entry] of hashed.entries()) {
    const cacheKey = `${entry.contentKey}:${entry.hash}`;
    const hit = cacheMap.get(cacheKey);

    if (hit) {
      results[i] = {
        contentKey: entry.contentKey,
        translatedText: hit.translated,
        sourceLocale: hit.sourceLocale,
        cached: true,
      };
    } else {
      misses.push({ originalIndex: i, entry });
    }
  }

  // 4. Call DeepL for misses
  if (misses.length > 0) {
    const textsToTranslate = misses.map((m) => m.entry.text);

    const deeplResults = await client.translateText(
      textsToTranslate,
      null, // auto-detect source language
      targetLocale as TargetLanguageCode,
      { tagHandling },
    );

    // translateText returns TextResult when input is single string,
    // TextResult[] when input is string[]. We always pass string[].
    const translationArray: TextResult[] = Array.isArray(deeplResults)
      ? deeplResults
      : [deeplResults];

    // 5. Write cache entries
    // The unique index is (contentKey, contentHash, targetLocale) — 3 columns.
    // sourceLocale is NOT part of the unique constraint because it's auto-detected
    // by DeepL and only known after the API call. On conflict, we update both
    // the translated text and the detected sourceLocale.
    const rowsToInsert: Array<{
      contentKey: string;
      contentHash: string;
      sourceLocale: string | null;
      targetLocale: string;
      translated: string;
    }> = [];

    for (const [i, result] of translationArray.entries()) {
      const miss = misses[i];
      if (miss) {
        rowsToInsert.push({
          contentKey: miss.entry.contentKey,
          contentHash: miss.entry.hash,
          sourceLocale: result.detectedSourceLang.toUpperCase(),
          targetLocale,
          translated: result.text,
        });
      }
    }

    if (rowsToInsert.length > 0) {
      await db
        .insert(contentTranslations)
        .values(rowsToInsert)
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

    // Fill results for misses
    for (const [i, miss] of misses.entries()) {
      const deeplResult = translationArray[i];
      if (deeplResult) {
        results[miss.originalIndex] = {
          contentKey: miss.entry.contentKey,
          translatedText: deeplResult.text,
          sourceLocale: deeplResult.detectedSourceLang.toUpperCase(),
          cached: false,
        };
      }
    }
  }

  // All slots should be filled — cast away the nulls
  return results as TranslationResult[];
}
