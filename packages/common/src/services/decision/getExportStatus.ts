import { db, eq } from '@op/db/client';
import { processInstances } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import { readExportRecord, refreshStaleSignedUrl } from '../exports';
import { exportFilePath, exportStatusCacheKey } from './exports';
import type { ExportStatusData } from './schemas/exportStatus';
import { exportStatusRecordSchema } from './schemas/exportStatus';

// Re-exported here because this module is where callers already look for it.
// `schemas/exportStatus.ts` derives the type from the schema that validates the
// record, so the type and the check cannot drift.
export type { ExportStatusData } from './schemas/exportStatus';

/**
 * Reads one proposal export's status, and re-signs its download URL when the
 * stored one is no longer usable.
 *
 * Authorization runs in a fixed order, and all of it before any signing. The
 * record's own `userId` settles ownership. `assertInstanceProfileAccess` then
 * settles `decisions: ADMIN` on the profile that owns the export, which is what
 * stops an admin who lost the role from holding a working download for the rest
 * of the record's day.
 *
 * The cache holds the only copy of the record, and {@link readExportRecord} owns
 * what that costs: it keeps "Redis held nothing" apart from "Redis did not
 * answer", and validates rather than asserts the shape it finds.
 *
 * @param exportId - The export to read. Also the cache key, via
 *   `exportStatusCacheKey`.
 * @param user - The calling user, checked for ownership and then for decision
 *   admin.
 * @returns The parsed record, whose `signedUrl` may have been refreshed or
 *   dropped, or `{ status: 'not_found' }` when the cache holds no usable record.
 * @throws CommonError when the cache did not answer. Reporting that as
 *   `not_found` would make the client retire a run that is still there.
 * @throws UnauthorizedError when the caller does not own the export, or no
 *   longer holds `decisions: ADMIN` on the owning profile.
 * @throws NotFoundError when the record names a process instance that is gone.
 */
export const getExportStatus = async ({
  exportId,
  user,
}: {
  exportId: string;
  user: User;
}): Promise<ExportStatusData | { status: 'not_found' }> => {
  const key = exportStatusCacheKey(exportId);

  const exportStatus = await readExportRecord({
    exportId,
    cacheKey: key,
    schema: exportStatusRecordSchema,
  });

  // No usable record, whether the cache held nothing or held something that
  // describes no export. The client returns to idle and the admin starts a
  // fresh run.
  if (!exportStatus) {
    return { status: 'not_found' as const };
  }

  // Verify user owns this export (basic ownership check)
  if (exportStatus.userId !== user.id) {
    throw new UnauthorizedError('You do not have access to this export');
  }

  // Additionally verify user still has access to the decision profile
  const instance = await db
    .select({
      profileId: processInstances.profileId,
    })
    .from(processInstances)
    .where(eq(processInstances.id, exportStatus.processInstanceId))
    .limit(1);

  if (!instance[0]) {
    throw new NotFoundError('Process instance', exportStatus.processInstanceId);
  }

  // Verify the caller still holds decision admin on the profile that owns the
  // export. This defers to the shared helper so every decision instance decides
  // access in one place, including the instance that carries no profile: the
  // helper reports that as unauthorized, where a local branch reported it as a
  // missing profile and answered an authorization question with the existence
  // of a record.
  //
  // `ownerProfileId` is null to skip the organization fallback. An export holds
  // the names of every proposal submitter, so it stays readable by an admin of
  // the decision profile itself, and not by anyone who holds an org-level grant
  // over that profile. Passing the real column here would widen the boundary
  // this module exists to narrow.
  await assertInstanceProfileAccess({
    user,
    instance: { profileId: instance[0].profileId, ownerProfileId: null },
    profilePermissions: { decisions: permission.ADMIN },
    orgFallbackPermissions: { decisions: permission.ADMIN },
  });

  // Mutates `exportStatus` in place, so the record returned below is current.
  await refreshStaleSignedUrl({
    record: exportStatus,
    exportId,
    resolveFilePath: (fileName) =>
      exportFilePath(exportStatus.processInstanceId, fileName),
    cacheKey: key,
  });

  return exportStatus;
};
