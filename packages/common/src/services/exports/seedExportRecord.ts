import { setWithStatus } from '@op/cache';

import { CommonError } from '../../utils';
import { EXPORT_CACHE_TTL_SECONDS } from './constants';

// Throws so no job is queued for a record its first status read cannot find.
export const seedExportRecord = async (
  cacheKey: string,
  record: Record<string, unknown>,
): Promise<void> => {
  const written = await setWithStatus(
    cacheKey,
    record,
    EXPORT_CACHE_TTL_SECONDS,
  );

  if (written.status !== 'ok') {
    throw new CommonError('Could not record the export request.');
  }
};
