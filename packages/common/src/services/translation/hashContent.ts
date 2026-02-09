import { createHash } from 'node:crypto';

/**
 * SHA-256 hash of content, truncated to 16 hex chars (64 bits).
 * Used as cache key — when content changes, hash changes, cache misses.
 */
export function hashContent(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}
