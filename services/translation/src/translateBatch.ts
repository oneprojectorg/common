import { and, db, eq, or, sql } from '@op/db/client';
import { contentTranslations } from '@op/db/schema';

import { hashContent } from './hashContent';
import type { TranslationProvider } from './providers';

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

// Detects the start of an HTML tag (`<tag` or `</tag`), used to tell HTML
// fragments (TipTap content) apart from plain-text fields (titles, categories,
// labels). Deliberately anchored to the `<` + letter prefix only — matching a
// full `<...>` with `[^>]*>` would rescan to end at every offset on input with
// no closing `>`, which is O(n²) backtracking on hostile strings like `<a<a…`.
const HTML_TAG_START = /<\/?[a-z]/i;

// DeepL, when given plain text under `tagHandling: 'html'`, treats it as an
// HTML document and wraps the loose text in a namespaced paragraph, e.g.
// `<p xmlns="http://www.w3.org/1999/xhtml">Proposal…</p>`. Matches a single
// outer <p> wrapper so we can peel it off plain-text results. Lazy capture +
// end anchor keep the match linear.
const PARAGRAPH_WRAPPER = /^\s*<p\b[^>]*>([\s\S]*?)<\/p>\s*$/i;

function isHtml(text: string): boolean {
  return HTML_TAG_START.test(text);
}

/**
 * Peel DeepL's spurious `<p xmlns="…xhtml">…</p>` wrapper off a translated
 * value when the *source* was plain text. Idempotent, and a no-op for genuine
 * HTML fragments (whose source already contains tags).
 */
function unwrapPlainText(sourceText: string, translatedText: string): string {
  if (isHtml(sourceText)) {
    return translatedText;
  }
  const match = PARAGRAPH_WRAPPER.exec(translatedText);
  return match?.[1] ?? translatedText;
}

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
  const texts = misses.map((m) => m.text);

  const results = await provider.translate(texts);

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
      translatedText: unwrapPlainText(miss.text, result.translatedText),
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

    // Heal stale cache entries that stored DeepL's paragraph-wrapped output for
    // a plain-text field; fresh translations are already unwrapped upstream.
    return {
      ...result,
      translatedText: unwrapPlainText(entry.text, result.translatedText),
    };
  });
}
