import { setWithStatus } from '@op/cache';
import { createSBServiceClient } from '@op/supabase/server';

import { CommonError } from '../../utils';
import { EXPORTS_BUCKET } from '../exports/constants';
import {
  personalDataExportCacheKey,
  personalDataExportFilePath,
} from './constants';

// File first: the record is the only thing that names it. Throws so the step retries.
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

  const deleted = await setWithStatus(
    personalDataExportCacheKey(exportId),
    null,
  );

  if (deleted.status === 'timeout' || deleted.status === 'error') {
    throw new CommonError('Could not delete the export record.');
  }
};
