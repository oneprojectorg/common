import { get, set } from '@op/cache';
import { logger } from '@op/logging';

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
 * The record fields that report a failed run. The cause is logged rather than
 * recorded: the client renders `errorMessage` verbatim, and a driver error
 * carries our SQL and its parameters — which, for a personal data export, are
 * the subject's own rows. Absent, the client shows its own translated copy.
 */
export const failedExportPatch = (exportId: string, error: unknown) => {
  logger.error('Export run failed', { exportId, error });

  return {
    status: 'failed' as const,
    completedAt: new Date().toISOString(),
  };
};
