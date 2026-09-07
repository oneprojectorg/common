import { get, set } from '@op/cache';

import { EXPORT_CACHE_TTL_SECONDS } from './constants';

/**
 * Merge an update into an export's cached status record.
 *
 * The read is guarded rather than asserted: `get` answers `unknown` and no
 * schema protects the cache on write, so spreading a string would scatter its
 * indices across the record. A missing record is not an error — the patch lands
 * alone and the reader's schema decides whether it still describes an export.
 */
export const patchExportRecord = async (
  cacheKey: string,
  updates: Record<string, unknown>,
): Promise<void> => {
  const existing = await get(cacheKey);
  const base =
    typeof existing === 'object' && existing !== null ? existing : {};

  await set(cacheKey, { ...base, ...updates }, EXPORT_CACHE_TTL_SECONDS);
};

/**
 * The record fields that report a failed run. `errorMessage` is always a string
 * because the client renders it verbatim and falls back to its own copy only
 * when the field is absent.
 */
export const failedExportPatch = (error: unknown) => ({
  status: 'failed' as const,
  errorMessage: error instanceof Error ? error.message : 'Unknown error',
  completedAt: new Date().toISOString(),
});
