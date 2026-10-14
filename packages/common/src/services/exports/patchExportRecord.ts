import { getWithStatus, setWithStatus } from '@op/cache';

import { CommonError } from '../../utils';
import { EXPORT_CACHE_TTL_SECONDS } from './constants';

// Throws on a cache failure so the calling step retries instead of recording
// a partial record or reporting a write that never landed.
export const patchExportRecord = async (
  cacheKey: string,
  updates: Record<string, unknown>,
): Promise<void> => {
  const existing = await getWithStatus(cacheKey);

  if (existing.status === 'timeout' || existing.status === 'error') {
    throw new CommonError('Could not read the export record.');
  }

  const base =
    existing.status === 'hit' &&
    typeof existing.data === 'object' &&
    existing.data !== null
      ? existing.data
      : {};

  const written = await setWithStatus(
    cacheKey,
    { createdAt: new Date().toISOString(), ...base, ...updates },
    EXPORT_CACHE_TTL_SECONDS,
  );

  if (written.status !== 'ok') {
    throw new CommonError('Could not write the export record.');
  }
};
