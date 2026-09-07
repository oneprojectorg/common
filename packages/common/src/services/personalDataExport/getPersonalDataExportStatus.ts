import { User } from '@op/supabase/lib';

import { UnauthorizedError } from '../../utils';
import { readExportRecord, refreshStaleSignedUrl } from '../exports';
import {
  personalDataExportCacheKey,
  personalDataExportFilePath,
} from './constants';
import type { PersonalDataExportStatusData } from './schemas';
import { personalDataExportRecordSchema } from './schemas';

/**
 * Read one personal data export's status, re-signing its download URL when the
 * stored one has lapsed.
 *
 * Ownership is the whole authorization question — no role grants access to
 * someone else's record — and it is settled before anything is signed.
 */
export const getPersonalDataExportStatus = async ({
  exportId,
  user,
}: {
  exportId: string;
  user: User;
}): Promise<PersonalDataExportStatusData | { status: 'not_found' }> => {
  const key = personalDataExportCacheKey(exportId);

  const exportStatus = await readExportRecord({
    exportId,
    cacheKey: key,
    schema: personalDataExportRecordSchema,
  });

  // A record that failed validation lands here too, and must: it carries no
  // `userId` for the ownership check below to compare against.
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
