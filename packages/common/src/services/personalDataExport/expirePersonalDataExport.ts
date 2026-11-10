import { setWithStatus } from '@op/cache';
import { createSBServiceClient } from '@op/supabase/server';

import { CommonError } from '../../utils';
import { EXPORTS_BUCKET } from '../exports/constants';
import {
  personalDataExportCacheKey,
  personalDataExportFilePath,
} from './constants';

/**
 * Deletes a finished export's file, then its record, once its lifetime is up.
 *
 * Throws on any failure so the calling step retries. Both deletes are
 * idempotent, so a retry after a partial run is safe. The file goes first:
 * the record is the only thing that names it, so dropping the record first
 * and then failing would leave the file with nothing to find it by.
 */
export const expirePersonalDataExport = async ({
  exportId,
  userId,
  fileName,
}: {
  exportId: string;
  userId: string;
  fileName: string;
}): Promise<void> => {
  const { error } = await createSBServiceClient()
    .storage.from(EXPORTS_BUCKET)
    .remove([personalDataExportFilePath(userId, fileName)]);

  if (error) {
    throw new CommonError(`Could not delete the export file: ${error.message}`);
  }

  // `null` deletes the key; a reader then sees `not_found`.
  const deleted = await setWithStatus(
    personalDataExportCacheKey(exportId),
    null,
  );

  if (deleted.status === 'timeout' || deleted.status === 'error') {
    throw new CommonError('Could not delete the export record.');
  }
};
