import { db } from '@op/db/client';
import { contentTranslations } from '@op/db/schema';
import type { DeepLClient } from 'deepl-node';
import { like } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import { TestTranslationDataManager } from '../../test/helpers/TestTranslationDataManager';
import { translateBatch } from './translateBatch';

/**
 * Creates a mock DeepL client that prefixes each text with `[{targetLocale}]`
 * and reports `detectedSourceLang` as `"en"`.
 */
function createMockClient() {
  const translateText = vi.fn(
    (texts: string[], _source: null, targetLocale: string) =>
      Promise.resolve(
        texts.map((t) => ({
          text: `[${targetLocale}] ${t}`,
          detectedSourceLang: 'en',
        })),
      ),
  );

  return {
    client: { translateText } as unknown as DeepLClient,
    translateText,
  };
}

/** Unique prefix per test to avoid cross-test collisions in the DB */
function testKey(testId: string, field: string) {
  return `test:${testId}:${field}`;
}

describe('translateBatch', () => {
  it('should return empty array for empty input', async () => {
    const { client } = createMockClient();

    const results = await translateBatch({
      entries: [],
      targetLocale: 'ES',
      client,
    });

    expect(results).toEqual([]);
  });

  it('should translate all entries via DeepL on cache miss', async ({
    task,
    onTestFinished,
  }) => {
    const { client, translateText } = createMockClient();
    const id = task.id;

    // Clean up any rows written by translateBatch's cache-through
    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `test:${id}:%`));
    });

    const results = await translateBatch({
      entries: [
        { contentKey: testKey(id, 'title'), text: 'Hello world' },
        { contentKey: testKey(id, 'body'), text: '<p>Some content</p>' },
      ],
      targetLocale: 'ES',
      client,
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      contentKey: testKey(id, 'title'),
      translatedText: '[ES] Hello world',
      sourceLocale: 'EN',
      cached: false,
    });
    expect(results[1]).toEqual({
      contentKey: testKey(id, 'body'),
      translatedText: '[ES] <p>Some content</p>',
      sourceLocale: 'EN',
      cached: false,
    });

    // DeepL was called once with both texts
    expect(translateText).toHaveBeenCalledOnce();
    expect(translateText).toHaveBeenCalledWith(
      ['Hello world', '<p>Some content</p>'],
      null,
      'ES',
      expect.objectContaining({ tagHandling: 'html' }),
    );
  });

  it('should return cached results without calling DeepL', async ({
    task,
    onTestFinished,
  }) => {
    const { client, translateText } = createMockClient();
    const translationData = new TestTranslationDataManager(onTestFinished);
    const id = task.id;

    // Pre-seed cache
    await translationData.seedTranslation({
      contentKey: testKey(id, 'title'),
      sourceText: 'Hello world',
      translatedText: '[ES-CACHED] Hello world',
      sourceLocale: 'EN',
      targetLocale: 'ES',
    });

    const results = await translateBatch({
      entries: [{ contentKey: testKey(id, 'title'), text: 'Hello world' }],
      targetLocale: 'ES',
      client,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      contentKey: testKey(id, 'title'),
      translatedText: '[ES-CACHED] Hello world',
      sourceLocale: 'EN',
      cached: true,
    });

    // DeepL should not have been called
    expect(translateText).not.toHaveBeenCalled();
  });

  it('should handle mixed cache hits and misses', async ({
    task,
    onTestFinished,
  }) => {
    const { client, translateText } = createMockClient();
    const translationData = new TestTranslationDataManager(onTestFinished);
    const id = task.id;

    // Pre-seed only the title
    await translationData.seedTranslation({
      contentKey: testKey(id, 'title'),
      sourceText: 'Hello world',
      translatedText: '[ES-CACHED] Hello world',
      sourceLocale: 'EN',
      targetLocale: 'ES',
    });

    // Clean up rows written by translateBatch for the body miss
    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `test:${id}:%`));
    });

    const results = await translateBatch({
      entries: [
        { contentKey: testKey(id, 'title'), text: 'Hello world' },
        { contentKey: testKey(id, 'body'), text: '<p>Fresh content</p>' },
      ],
      targetLocale: 'ES',
      client,
    });

    expect(results).toHaveLength(2);

    // Title came from cache
    expect(results[0]).toEqual({
      contentKey: testKey(id, 'title'),
      translatedText: '[ES-CACHED] Hello world',
      sourceLocale: 'EN',
      cached: true,
    });

    // Body was translated fresh
    expect(results[1]).toEqual({
      contentKey: testKey(id, 'body'),
      translatedText: '[ES] <p>Fresh content</p>',
      sourceLocale: 'EN',
      cached: false,
    });

    // DeepL was only called with the body, not the title
    expect(translateText).toHaveBeenCalledOnce();
    expect(translateText).toHaveBeenCalledWith(
      ['<p>Fresh content</p>'],
      null,
      'ES',
      expect.objectContaining({ tagHandling: 'html' }),
    );
  });

  it('should preserve input order when cache hits and misses are interleaved', async ({
    task,
    onTestFinished,
  }) => {
    const { client } = createMockClient();
    const translationData = new TestTranslationDataManager(onTestFinished);
    const id = task.id;

    // Seed entries at positions 1 and 3 (0-indexed), leave 0 and 2 as misses
    await translationData.seedTranslation({
      contentKey: testKey(id, 'b'),
      sourceText: 'Second',
      translatedText: '[CACHED] Second',
      sourceLocale: 'EN',
      targetLocale: 'FR',
    });
    await translationData.seedTranslation({
      contentKey: testKey(id, 'd'),
      sourceText: 'Fourth',
      translatedText: '[CACHED] Fourth',
      sourceLocale: 'EN',
      targetLocale: 'FR',
    });

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `test:${id}:%`));
    });

    const results = await translateBatch({
      entries: [
        { contentKey: testKey(id, 'a'), text: 'First' },
        { contentKey: testKey(id, 'b'), text: 'Second' },
        { contentKey: testKey(id, 'c'), text: 'Third' },
        { contentKey: testKey(id, 'd'), text: 'Fourth' },
      ],
      targetLocale: 'FR',
      client,
    });

    expect(results.map((r) => r.contentKey)).toEqual([
      testKey(id, 'a'),
      testKey(id, 'b'),
      testKey(id, 'c'),
      testKey(id, 'd'),
    ]);

    expect(results.map((r) => r.cached)).toEqual([false, true, false, true]);
  });

  it('should write through to cache so a second call hits', async ({
    task,
    onTestFinished,
  }) => {
    const { client, translateText } = createMockClient();
    const id = task.id;

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `test:${id}:%`));
    });

    const entries = [{ contentKey: testKey(id, 'title'), text: 'Cache me' }];

    // First call — cache miss, hits DeepL
    const first = await translateBatch({
      entries,
      targetLocale: 'DE',
      client,
    });

    expect(first[0]?.cached).toBe(false);
    expect(translateText).toHaveBeenCalledOnce();

    translateText.mockClear();

    // Second call — same content, should hit cache
    const second = await translateBatch({
      entries,
      targetLocale: 'DE',
      client,
    });

    expect(second[0]?.cached).toBe(true);
    expect(second[0]?.translatedText).toBe('[DE] Cache me');
    expect(translateText).not.toHaveBeenCalled();
  });

  it('should cache-miss when content changes for the same key', async ({
    task,
    onTestFinished,
  }) => {
    const { client, translateText } = createMockClient();
    const translationData = new TestTranslationDataManager(onTestFinished);
    const id = task.id;

    // Seed with old content
    await translationData.seedTranslation({
      contentKey: testKey(id, 'title'),
      sourceText: 'Old title',
      translatedText: '[ES] Old title',
      sourceLocale: 'EN',
      targetLocale: 'ES',
    });

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `test:${id}:%`));
    });

    // Translate with updated content — different hash, should miss
    const results = await translateBatch({
      entries: [{ contentKey: testKey(id, 'title'), text: 'New title' }],
      targetLocale: 'ES',
      client,
    });

    expect(results[0]?.cached).toBe(false);
    expect(results[0]?.translatedText).toBe('[ES] New title');
    expect(translateText).toHaveBeenCalledOnce();
  });
});
