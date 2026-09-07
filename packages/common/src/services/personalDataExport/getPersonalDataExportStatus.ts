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
 * Read one personal data export's status, and re-sign its download URL when the
 * stored one is no longer usable.
 *
 * Ownership is the whole authorization question here, and the record's own
 * `userId` settles it. There is no second gate, because there is no role that
 * grants access to someone else's export: this file is one person's record, and
 * the only reader is that person.
 *
 * That check runs before any signing, so a caller who does not own the export
 * never causes a URL to be minted for it.
 *
 * The cache holds the only copy of the record, and {@link readExportRecord} owns
 * what that costs: it keeps "Redis held nothing" apart from "Redis did not
 * answer", and validates rather than asserts the shape it finds.
 *
 * @param exportId - The export to read. Also the cache key, via
 *   `personalDataExportCacheKey`.
 * @param user - The calling user, checked against the record's subject.
 * @returns The parsed record, whose `signedUrl` may have been refreshed or
 *   dropped, or `{ status: 'not_found' }` when the cache holds no usable record.
 * @throws CommonError when the cache did not answer. Reporting that as
 *   `not_found` would make the client retire a run that is still there.
 * @throws UnauthorizedError when the caller is not the export's subject.
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

  // No usable record. A record that failed validation lands here too, and it
  // matters that it does: such a record carries no `userId`, so there is no
  // owner for the check below to compare the caller against.
  if (!exportStatus) {
    return { status: 'not_found' as const };
  }

  if (exportStatus.userId !== user.id) {
    throw new UnauthorizedError('You do not have access to this export');
  }

  // Mutates `exportStatus` in place, so the record returned below is current.
  await refreshStaleSignedUrl({
    record: exportStatus,
    exportId,
    resolveFilePath: (fileName) =>
      personalDataExportFilePath(exportStatus.userId, fileName),
    cacheKey: key,
  });

  return exportStatus;
};
