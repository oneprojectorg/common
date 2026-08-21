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

export interface ExportStatusData {
  exportId: string;
  processInstanceId: string;
  userId: string;
  format: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileName?: string;
  signedUrl?: string;
  urlExpiresAt?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

/**
 * The logging surface this module needs, taken from the real {@link Logger} so
 * the two signatures cannot drift from what callers actually pass. A structural
 * literal would also have accepted `Record<string, unknown>` for the metadata,
 * which is the escape hatch this codebase avoids.
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

  // Read the cache in a way that keeps "no such export" apart from "the cache
  // could not answer". Both used to arrive as `null`, and reporting the second
  // as `not_found` is not a cosmetic error: export state lives only here, and
  // the client retires the export id on that answer. One Redis timeout would
  // discard a finished run of up to a thousand proposals, with the toast beside
  // it telling the admin to retry something no longer on screen.
  const cached = await getWithStatus(key);

  if (cached.status === 'timeout' || cached.status === 'error') {
    throw new CommonError('Could not read the export record.');
  }

  const exportStatus =
    cached.status === 'hit' ? (cached.data as ExportStatusData) : null;

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

  if (!instance[0].profileId) {
    throw new NotFoundError('Decision profile', exportStatus.processInstanceId);
  }

  // Verify user has admin permission on the profile
  await assertProfileAccess({
    user,
    profileId: instance[0].profileId,
    permissions: [{ decisions: permission.ADMIN }],
  });

  // Signed URLs are shorter-lived than the export record, so a completed export
  // is re-signed on read once its current URL has lapsed.
  //
  // A missing `fileName` is handled inside rather than skipped here. Skipping
  // returned the record untouched, which the client reads as a completed export
  // it can retry — and every retry takes this same branch back out again, so the
  // button never resolves and never clears. Absent a file name there is nothing
  // to sign and no read that changes that, which is the terminal case.
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
 * Split out of {@link getExportStatus} to keep that function about
 * authorization: everything here runs only after the caller has been checked.
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
    // Should not happen: the workflow writes `fileName` and `completed` in one
    // update. Logged rather than passed over silently, because reaching it means
    // a record was written by something that does not agree with that.
    logger.error('Completed export has no file name', { exportId });

    return { ...exportStatus, status: 'failed', signedUrl: undefined };
  }

  logger.info('Refreshing expired signed URL', { exportId });

  const filePath = exportFilePath(
    exportStatus.processInstanceId,
    exportStatus.fileName,
  );

  // Service-role: every `storage.objects` policy is scoped to
  // `bucket_id = 'assets'`, so a caller-scoped client cannot sign in this
  // bucket. The ownership and `decisions: ADMIN` checks in the caller are what
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

    // A missing object is permanent for this record: retrying can only fail the
    // same way, so report a terminal failure and let the admin start a fresh
    // run. Without this, a record whose file is genuinely gone — every export
    // cached across the deploy that moved buckets, for one — would offer a
    // retry that could never succeed until its 24h TTL ran out.
    //
    // Matched on the message because nothing else distinguishes it: this
    // Supabase build answers `status` 400 for every signing failure, with no
    // code to key on. Both wordings are checked — this build answers "Object not
    // found" even for a missing bucket, but storage-api has a distinct
    // `NoSuchBucket` that reads "Bucket not found", and either way the file is
    // unreachable for good. A wording this misses degrades to the retryable
    // branch, which is the safe direction.
    const permanentlyGone = ['Object not found', 'Bucket not found'].some(
      (reason) => signed.error?.message.includes(reason),
    );

    if (permanentlyGone) {
      return { ...exportStatus, status: 'failed', signedUrl: undefined };
    }

    // Anything else may be momentary. The run succeeded and the object is still
    // there, so report a completed export with no URL — which the client offers
    // to retry — rather than a terminal failure that would make it discard the
    // export id and cost a re-export of up to a thousand proposals. Not the
    // lapsed URL either: that renders as a download which 400s. The cached
    // record is left untouched so the retry re-reads one still `completed`.
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
 * How close to expiry a URL is treated as already lapsed.
 *
 * Without a margin a URL with seconds left is judged fresh and handed to the
 * client, which then 400s when the admin clicks — silently, because taking the
 * download clears the export id. A small lead also absorbs clock skew between
 * this process and storage. The cost of being wrong is one signing call.
 */
const URL_EXPIRY_GRACE_MS = 60 * 1000;

/**
 * Whether a completed export's download URL needs re-signing.
 *
 * A missing or unparseable expiry counts as lapsed. `new Date('nonsense') <
 * new Date()` is false, so treating the comparison as the whole test would read
 * a garbled timestamp as *fresh* and keep serving whatever `signedUrl` the
 * record holds — a dead one, or none at all — for the rest of its 24h life.
 * Erring towards a re-sign costs one signing call and is self-correcting.
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
