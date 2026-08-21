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
  exportDownloadOptions,
  exportFilePath,
  exportStatusCacheKey,
} from './exports';
import type { ExportStatusData } from './schemas/exportStatus';
import { exportStatusRecordSchema } from './schemas/exportStatus';

/**
 * Does a stored signed URL ask Supabase for an attachment?
 *
 * `exportDownloadOptions` sets a `download` query parameter. That parameter
 * makes the CSV save instead of render. Expiry alone therefore does not report
 * whether a stored URL still works.
 *
 * `exportStatusRecordSchema` already rejects a record whose `signedUrl` is not
 * a string, so this only reads a URL the schema passed. It still runs outside
 * the re-sign's catch, so it returns false rather than throws.
 */
const servesAsAttachment = (signedUrl: unknown): boolean => {
  if (typeof signedUrl !== 'string') {
    return false;
  }

  const query = signedUrl.split('?')[1];

  return query !== undefined && new URLSearchParams(query).has('download');
};

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

  // Mutates `exportStatus` in place, so the record returned below is current.
  await refreshStaleSignedUrl({ exportStatus, cacheKey: key, logger });

  return exportStatus;
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
const URL_EXPIRY_MARGIN_MS = 60 * 1000;

/**
 * Reports whether a completed export needs a new download URL.
 *
 * Three cases call for one. The URL has expired, or expires within
 * {@link URL_EXPIRY_MARGIN_MS}. The URL predates the download option, so it
 * renders instead of saving. The expiry is missing or unparseable, which is no
 * evidence of a working URL.
 *
 * A missing or unparseable expiry counts as lapsed for a reason.
 * `new Date('nonsense') < new Date()` is false, so a bare comparison reads a
 * garbled timestamp as fresh. The record would then serve whatever `signedUrl`
 * it holds, dead or absent, for the rest of its 24 hour life.
 *
 * Only `fileName` is required. It rebuilds the storage key.
 */
const needsFreshUrl = ({
  status,
  fileName,
  signedUrl,
  urlExpiresAt,
}: ExportStatusData): boolean => {
  if (status !== 'completed' || !fileName) {
    return false;
  }

  // `Date.parse` converts its argument to a string first, so a numeric 42 reads
  // as the year 2042. The `typeof` guard sends a missing and a non-string expiry
  // to NaN alike.
  const expiresAt =
    typeof urlExpiresAt === 'string' ? Date.parse(urlExpiresAt) : Number.NaN;

  return (
    Number.isNaN(expiresAt) ||
    expiresAt < Date.now() + URL_EXPIRY_MARGIN_MS ||
    !servesAsAttachment(signedUrl)
  );
};

/**
 * Sign an attachment-serving download URL for an export's stored file.
 *
 * This uses the service-role client. Every `storage.objects` policy scopes to
 * `bucket_id = 'assets'`, so a caller-scoped client cannot sign in this bucket.
 * The caller settles authorization first, as it does for `getProposal`.
 *
 * This throws on failure, so one caller decides what a failed re-sign costs.
 */
const mintSignedDownloadUrl = async ({
  processInstanceId,
  fileName,
}: {
  processInstanceId: string;
  fileName: string;
}): Promise<string> => {
  const supabase = createSBServiceClient();
  const { data, error } = await supabase.storage
    .from(EXPORTS_BUCKET)
    .createSignedUrl(
      exportFilePath(processInstanceId, fileName),
      EXPORT_URL_TTL_SECONDS,
      exportDownloadOptions(fileName),
    );

  if (error || !data) {
    throw error ?? new Error('Signing returned no URL');
  }

  return data.signedUrl;
};

/**
 * Re-sign a stale export URL in place and cache the result.
 *
 * A still-good URL stays as it is. A failed signature drops the URL from the
 * record, because the bucket is private and a lapsed signature is a dead link
 * rather than a degraded one. It also leaves the cache alone, so the client's
 * retry re-reads a record still marked `completed`.
 *
 * A failed cache write still returns the fresh URL. The next read re-signs.
 */
const refreshStaleSignedUrl = async ({
  exportStatus,
  cacheKey,
  logger,
}: {
  exportStatus: ExportStatusData;
  cacheKey: string;
  logger: ExportStatusLogger;
}): Promise<void> => {
  const { exportId, fileName } = exportStatus;

  if (!fileName) {
    if (exportStatus.status === 'completed') {
      // The workflow writes `fileName` and `completed` in one update, so this
      // branch should not run. Reaching it means another writer disagrees with
      // the workflow.
      //
      // This reports a terminal failure rather than passing the record over.
      // Returning the record untouched reads to the client as a completed export
      // it can retry, and every retry lands back here. The button would never
      // resolve and never clear. Without a file name there is nothing to sign,
      // and no later read supplies one.
      logger.error('Completed export has no file name', { exportId });

      exportStatus.status = 'failed';
      exportStatus.signedUrl = undefined;
    }

    return;
  }

  if (!needsFreshUrl(exportStatus)) {
    return;
  }

  logger.info('Refreshing signed URL', { exportId });

  // Broad on purpose: this is a degradation boundary, not error handling. A
  // failed re-sign costs the caller the download link. An escaped throw costs
  // the whole record, which sends the button to its error boundary.
  // `createSBServiceClient` throws synchronously, so it is inside the try.
  try {
    exportStatus.signedUrl = await mintSignedDownloadUrl({
      processInstanceId: exportStatus.processInstanceId,
      fileName,
    });
    exportStatus.urlExpiresAt = new Date(
      Date.now() + EXPORT_URL_TTL_SECONDS * 1000,
    ).toISOString();

    await set(cacheKey, exportStatus, EXPORT_CACHE_TTL_SECONDS);
  } catch (error) {
    logger.error('Failed to re-sign export URL', { exportId, error });

    // The lapsed URL does not go back on the record, whatever failed. It
    // renders as a download that answers 400.
    exportStatus.signedUrl = undefined;

    // A missing object is permanent for this record. A retry fails the same
    // way, so this reports a terminal failure and the admin starts a fresh run.
    // Without it, a record whose file is gone offers a retry that never
    // succeeds until the 24 hour time-to-live (TTL) expires. Every export
    // cached across the deploy that moved buckets is such a record.
    //
    // Any other failure may be momentary. The run succeeded and the object
    // remains in the bucket, so the record stays `completed` with no URL. The
    // client offers a retry for that state.
    //
    // A terminal failure there would make the client discard the export id, and
    // cost a re-export of up to a thousand proposals.
    //
    // This leaves the cached record alone either way, so a retry re-reads a
    // record still marked `completed`.
    if (isPermanentlyGone(error)) {
      exportStatus.status = 'failed';
    }
  }
};

/**
 * Reports whether a signing failure means the file is gone for good.
 *
 * The check matches on the message because nothing else separates the two
 * cases. This Supabase build answers `status` 400 for every signing failure,
 * and supplies no error code.
 *
 * The check covers two wordings. This build answers "Object not found" even for
 * a missing bucket. storage-api has a distinct `NoSuchBucket` that reads
 * "Bucket not found". Either wording means the file is unreachable. A wording
 * this check misses falls to the retryable branch, which is the safe direction.
 */
const PERMANENT_SIGNING_FAILURES = ['Object not found', 'Bucket not found'];

const isPermanentlyGone = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return false;
  }

  const { message } = error;

  return (
    typeof message === 'string' &&
    PERMANENT_SIGNING_FAILURES.some((reason) => message.includes(reason))
  );
};
