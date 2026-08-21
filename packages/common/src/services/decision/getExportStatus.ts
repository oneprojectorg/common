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

/**
 * Does a stored signed URL ask Supabase for an attachment?
 *
 * `exportDownloadOptions` sets a `download` query param. That param is what
 * makes the CSV save instead of render, so expiry alone does not tell you
 * whether a stored URL still works.
 *
 * Takes `unknown` because the cached record is an unvalidated cast over Redis
 * JSON. This runs outside the re-sign's catch, so a non-string must return
 * false rather than throw.
 */
const servesAsAttachment = (signedUrl: unknown): boolean => {
  if (typeof signedUrl !== 'string') {
    return false;
  }

  const query = signedUrl.split('?')[1];

  return query !== undefined && new URLSearchParams(query).has('download');
};

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

  // Callers declare `signedUrl` as a string and reject the whole record if it
  // is not one. The re-sign skips records that never completed, so scrub here.
  if (typeof exportStatus.signedUrl !== 'string') {
    exportStatus.signedUrl = undefined;
  }

  // Mutates `exportStatus` in place, so the record returned below is current.
  await refreshStaleSignedUrl({ exportStatus, cacheKey: key, logger });

  return exportStatus;
};

/**
 * How much life a stored URL needs to be worth returning.
 *
 * Without a margin, a URL with seconds left reads as fresh and then dies before
 * the click. The button drops its export id on click, so the admin has to
 * re-run the whole export.
 */
const URL_EXPIRY_MARGIN_MS = 60 * 1000;

/**
 * Is a stored export URL unusable?
 *
 * Three cases make it so. The URL has expired, or expires within
 * {@link URL_EXPIRY_MARGIN_MS}. The URL predates the download option, so it
 * renders instead of saving however long it has left. Or the expiry is missing
 * or unreadable, which is no evidence of a working URL.
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
 * Service-role client: every `storage.objects` policy is scoped to
 * `bucket_id = 'assets'`, so a caller-scoped client cannot sign in this bucket.
 * Callers settle authorization first, as they do for `getProposal`.
 *
 * Throws on failure, so one caller decides what a failed re-sign costs.
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
 * A still-good URL is left alone. A failed signature drops the URL from the
 * record — the bucket is private, so a lapsed signature is a dead link, not a
 * degraded one — and leaves the cache untouched, so the client's retry re-reads
 * a record still marked `completed`. A failed cache write still returns the
 * fresh URL, and the next read re-signs again.
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
      // Should not happen: the workflow writes `fileName` and `completed` in one
      // update. Reported as a terminal failure rather than passed over, because
      // returning the record untouched reads to the client as a completed export
      // it can retry — and every retry lands back here, so the button never
      // resolves and never clears. Absent a file name there is nothing to sign
      // and no later read grows one.
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

    // Whatever happened, the lapsed URL does not go back on the record: it
    // renders as a download that 400s.
    exportStatus.signedUrl = undefined;

    // A missing object is permanent for this record — retrying can only fail the
    // same way — so report a terminal failure and let the admin start a fresh
    // run. Without this, a record whose file is genuinely gone (every export
    // cached across the deploy that moved buckets, for one) would offer a retry
    // that could never succeed until its 24h TTL ran out.
    //
    // Anything else may be momentary. The run succeeded and the object is still
    // there, so the record stays `completed` with no URL, which the client
    // offers to retry — rather than a terminal failure that would make it
    // discard the export id and cost a re-export of up to a thousand proposals.
    // The cached record is left untouched either way, so a retry re-reads one
    // still marked `completed`.
    if (isPermanentlyGone(error)) {
      exportStatus.status = 'failed';
    }
  }
};

/**
 * Is a signing failure a file that is gone rather than a momentary fault?
 *
 * Matched on the message because nothing else distinguishes the two: this
 * Supabase build answers `status` 400 for every signing failure, with no code to
 * key on. Both wordings are checked — this build answers "Object not found" even
 * for a missing bucket, but storage-api has a distinct `NoSuchBucket` that reads
 * "Bucket not found", and either way the file is unreachable for good. A wording
 * this misses degrades to the retryable branch, which is the safe direction.
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
