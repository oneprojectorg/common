import { getWithStatus, set } from '@op/cache';
import { db, eq } from '@op/db/client';
import { processInstances } from '@op/db/schema';
import type { Logger } from '@op/logging';
import { User } from '@op/supabase/lib';
import { createSBServiceClient } from '@op/supabase/server';
import { permission } from 'access-zones';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { assertProfileAccess } from '../assert';
import {
  EXPORTS_BUCKET,
  EXPORT_CACHE_TTL_SECONDS,
  EXPORT_URL_TTL_SECONDS,
  exportFilePath,
  exportStatusCacheKey,
} from './exports';
import type { ExportStatusData } from './schemas/exportStatus';
import { exportStatusRecordSchema } from './schemas/exportStatus';

// Re-exported here because this module is where callers already look for it.
// `schemas/exportStatus.ts` derives the type from the schema that validates the
// record, so the type and the check cannot drift.
export type { ExportStatusData } from './schemas/exportStatus';

/**
 * The logging methods this module needs.
 *
 * The type derives from {@link Logger}, so it cannot drift from what a caller
 * passes. A structural literal would accept `Record<string, unknown>` for the
 * metadata, and this codebase avoids that escape hatch.
 */
type ExportStatusLogger = Pick<Logger, 'info' | 'error'>;

export const getExportStatus = async ({
  exportId,
  user,
  logger,
}: {
  exportId: string;
  user: User;
  logger: ExportStatusLogger;
}): Promise<ExportStatusData | { status: 'not_found' }> => {
  const key = exportStatusCacheKey(exportId);

  // Keep "no such export" apart from "the cache did not answer". Both arrived
  // as `null` before. Export state lives only in the cache, and the client
  // retires the export id when it reads `not_found`. One Redis timeout
  // therefore discarded a finished run of up to a thousand proposals. The toast
  // beside it told the admin to retry a control no longer on screen.
  const cached = await getWithStatus(key);

  if (cached.status === 'timeout' || cached.status === 'error') {
    throw new CommonError('Could not read the export record.');
  }

  if (cached.status !== 'hit') {
    return { status: 'not_found' as const };
  }

  // Parse the cached value rather than assert its type. Redis holds the only
  // copy of this record, so nothing else checks the shape this path depends on.
  //
  // A malformed record is reachable. The workflow patches the record by merging
  // over the copy it reads, and it writes the patch alone when that read misses.
  // A cache eviction, or one unreachable Redis, therefore leaves a record that
  // holds a status and nothing else.
  //
  // Such a record describes no export, and no later read repairs it. This
  // reports `not_found`, so the client returns to idle and the admin starts a
  // fresh run.
  const parsed = exportStatusRecordSchema.safeParse(cached.data);

  if (!parsed.success) {
    logger.error('Cached export record does not match its schema', {
      exportId,
      error: parsed.error,
    });

    return { status: 'not_found' as const };
  }

  const exportStatus = parsed.data;

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

  if (!instance[0].profileId) {
    throw new NotFoundError('Decision profile', exportStatus.processInstanceId);
  }

  // Verify user has admin permission on the profile
  await assertProfileAccess({
    user,
    profileId: instance[0].profileId,
    permissions: [{ decisions: permission.ADMIN }],
  });

  // A signed URL expires before the export record does. This re-signs a
  // completed export once its current URL has lapsed.
  //
  // `refreshSignedUrl` handles a missing `fileName`; this guard does not skip
  // it. Skipping returned the record untouched, and the client read that as a
  // completed export it could retry. Every retry reached this branch again, so
  // the button never resolved and never cleared. Without a file name there is
  // nothing to sign, and no later read supplies one.
  if (
    exportStatus.status === 'completed' &&
    isSignedUrlLapsed(exportStatus.urlExpiresAt)
  ) {
    return refreshSignedUrl({ exportStatus, exportId, logger });
  }

  return exportStatus;
};

/**
 * Re-sign a completed export whose download URL has lapsed.
 *
 * This is separate from {@link getExportStatus} so that function stays about
 * authorization. Everything here runs after that function checks the caller.
 */
const refreshSignedUrl = async ({
  exportStatus,
  exportId,
  logger,
}: {
  exportStatus: ExportStatusData;
  exportId: string;
  logger: ExportStatusLogger;
}): Promise<ExportStatusData> => {
  if (!exportStatus.fileName) {
    // The workflow writes `fileName` and `completed` in one update, so this
    // branch should not run. It logs rather than passes over the record
    // silently: reaching it means another writer disagrees with the workflow.
    logger.error('Completed export has no file name', { exportId });

    return { ...exportStatus, status: 'failed', signedUrl: undefined };
  }

  logger.info('Refreshing expired signed URL', { exportId });

  const filePath = exportFilePath(
    exportStatus.processInstanceId,
    exportStatus.fileName,
  );

  // This uses the service-role client. Every `storage.objects` policy scopes to
  // `bucket_id = 'assets'`, so a caller-scoped client cannot sign in this
  // bucket. The ownership check and the `decisions: ADMIN` check in the caller
  // authorize this read.
  const supabase = createSBServiceClient();

  const signed = await supabase.storage
    .from(EXPORTS_BUCKET)
    .createSignedUrl(filePath, EXPORT_URL_TTL_SECONDS);

  if (signed.error || !signed.data) {
    logger.error('Failed to refresh export signed URL', {
      error: signed.error,
      exportId,
    });

    // A missing object is permanent for this record. A retry fails the same
    // way, so this reports a terminal failure and the admin starts a fresh run.
    // Without it, a record whose file is gone offers a retry that never
    // succeeds until the 24 hour TTL expires. Every export cached across the
    // deploy that moved buckets is such a record.
    //
    // The check matches on the message because nothing else separates the two
    // cases. This Supabase build answers `status` 400 for every signing
    // failure, and supplies no error code.
    //
    // The check covers two wordings. This build answers "Object not found" even
    // for a missing bucket. storage-api has a distinct `NoSuchBucket` that
    // reads "Bucket not found". Either wording means the file is unreachable. A
    // wording this check misses falls to the retryable branch below, which is
    // the safe direction.
    const permanentlyGone = ['Object not found', 'Bucket not found'].some(
      (reason) => signed.error?.message.includes(reason),
    );

    if (permanentlyGone) {
      return { ...exportStatus, status: 'failed', signedUrl: undefined };
    }

    // Any other failure may be momentary. The run succeeded and the object
    // remains in the bucket, so this reports a completed export with no URL.
    // The client offers a retry for that state.
    //
    // A terminal failure here would make the client discard the export id, and
    // cost a re-export of up to a thousand proposals. The lapsed URL is also
    // wrong to return: it renders as a download that answers 400.
    //
    // This leaves the cached record alone, so the retry re-reads a record still
    // marked `completed`.
    return { ...exportStatus, signedUrl: undefined };
  }

  const refreshed: ExportStatusData = {
    ...exportStatus,
    signedUrl: signed.data.signedUrl,
    urlExpiresAt: new Date(
      Date.now() + EXPORT_URL_TTL_SECONDS * 1000,
    ).toISOString(),
  };

  await set(
    exportStatusCacheKey(exportId),
    refreshed,
    EXPORT_CACHE_TTL_SECONDS,
  );

  return refreshed;
};

/**
 * The margin within which this module treats a URL as already lapsed.
 *
 * Without a margin, a URL with seconds left passes as fresh. The client then
 * receives it, and it answers 400 when the admin clicks. The admin sees no
 * error, because taking the download clears the export id.
 *
 * The margin also absorbs clock skew between this process and storage. A margin
 * that fires early costs one signing call.
 */
const URL_EXPIRY_GRACE_MS = 60 * 1000;

/**
 * Reports whether a completed export needs a new download URL.
 *
 * A missing expiry counts as lapsed. An unparseable expiry counts as lapsed.
 * `new Date('nonsense') < new Date()` is false, so a bare comparison reads a
 * garbled timestamp as fresh. The record would then serve whatever `signedUrl`
 * it holds, dead or absent, for the rest of its 24 hour life.
 *
 * A wrong answer here costs one signing call, and the next read corrects it.
 */
const isSignedUrlLapsed = (urlExpiresAt: string | undefined): boolean => {
  if (!urlExpiresAt) {
    return true;
  }

  const expiresAt = Date.parse(urlExpiresAt);

  return (
    Number.isNaN(expiresAt) || expiresAt - URL_EXPIRY_GRACE_MS < Date.now()
  );
};
