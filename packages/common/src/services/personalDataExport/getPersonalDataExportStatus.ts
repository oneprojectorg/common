import { User } from '@op/supabase/lib';

import { UnauthorizedError } from '../../utils';
import { readExportRecord, signCompletedExport } from '../exports';
import {
  PERSONAL_DATA_EXPORT_URL_TTL_SECONDS,
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
  const exportStatus = await readExportRecord({
    exportId,
    cacheKey: personalDataExportCacheKey(exportId),
    schema: personalDataExportRecordSchema,
  });

  if (!exportStatus) {
    return { status: 'not_found' as const };
  }

  if (exportStatus.userId !== user.id) {
    throw new UnauthorizedError('You do not have access to this export');
  }

  const response: typeof exportStatus & { signedUrl?: string } = {
    ...exportStatus,
  };

  await signCompletedExport({
    record: response,
    exportId,
    resolveFilePath: (fileName) =>
      personalDataExportFilePath(exportStatus.userId, fileName),
    ttlSeconds: PERSONAL_DATA_EXPORT_URL_TTL_SECONDS,
  });

  return response;
};
