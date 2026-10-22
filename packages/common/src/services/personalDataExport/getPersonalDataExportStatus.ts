import { User } from '@op/supabase/lib';

import { UnauthorizedError } from '../../utils';
import { readExportRecord, refreshStaleSignedUrl } from '../exports';
import {
  personalDataExportCacheKey,
  personalDataExportFilePath,
} from './constants';
import { personalDataExportRecordSchema } from './schemas';

export const getPersonalDataExportStatus = async ({
  exportId,
  user,
}: {
  exportId: string;
  user: User;
}) => {
  const key = personalDataExportCacheKey(exportId);

  const exportStatus = await readExportRecord({
    exportId,
    cacheKey: key,
    schema: personalDataExportRecordSchema,
  });

  if (!exportStatus) {
    return { status: 'not_found' as const };
  }

  if (exportStatus.userId !== user.id) {
    throw new UnauthorizedError('You do not have access to this export');
  }

  await refreshStaleSignedUrl({
    record: exportStatus,
    exportId,
    resolveFilePath: (fileName) =>
      personalDataExportFilePath(exportStatus.userId, fileName),
    cacheKey: key,
  });

  return exportStatus;
};
