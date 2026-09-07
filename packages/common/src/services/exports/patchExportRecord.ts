import { get, set } from '@op/cache';

import { EXPORT_CACHE_TTL_SECONDS } from './constants';

/**
 * Merge an update into an export's cached status record.
 *
 * Every export workflow reports progress this way. The request seeds the record
 * in full, so each write here patches an existing one rather than replacing it —
 * a run that reported `processing` must not drop the subject or the format on
 * its way to `completed`.
 *
 * The read is guarded rather than asserted. `get` answers `unknown`, and the
 * record it returns comes from a cache no schema protects on write, so a value
 * that is not an object is treated as no record at all. Spreading one would
 * scatter a string's indices across the record.
 *
 * A missing record is not an error here. The write goes ahead with the patch
 * alone, and the reader's schema is what decides whether what survives still
 * describes an export.
 *
 * @param cacheKey - Where the record lives. Each pipeline owns its key format.
 * @param updates - Fields to merge over the stored record.
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
 * The record fields that report a failed export run.
 *
 * Shared so every pipeline fails the same way. The client reads `errorMessage`
 * verbatim and falls back to its own translated copy when the field is absent,
 * so an unrecognised throw must still leave a string here rather than
 * `undefined`.
 *
 * @param error - What the run threw. Typed `unknown` because a caught value
 *   carries no guarantee.
 * @returns The patch to hand {@link patchExportRecord}.
 */
export const failedExportPatch = (error: unknown) => ({
  status: 'failed' as const,
  errorMessage: error instanceof Error ? error.message : 'Unknown error',
  completedAt: new Date().toISOString(),
});
