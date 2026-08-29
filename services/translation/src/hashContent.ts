import { createHash } from 'node:crypto';

import type { TranslationFormat } from './providers';

/**
 * SHA-256 hash of content, truncated to 16 hex chars (64 bits).
 * Used as cache key — when content changes, hash changes, cache misses.
 *
 * `format` is folded in so the plain-text fix invalidates its own cache: rows
 * translated before it was in place hold DeepL's `<p xmlns=…>` wrapper, and
 * without a new key they would keep being served. Only `text` is prefixed, so
 * html entries keep their existing hashes and their cache.
 */
export function hashContent(
  text: string,
  format: TranslationFormat = 'html',
): string {
  const input = format === 'html' ? text : `text:${text}`;

  return createHash('sha256').update(input, 'utf8').digest('hex').slice(0, 16);
}
