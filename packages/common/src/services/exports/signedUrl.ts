import { set } from '@op/cache';
import { logger } from '@op/logging';
import { createSBServiceClient } from '@op/supabase/server';

import {
  EXPORTS_BUCKET,
  EXPORT_CACHE_TTL_SECONDS,
  EXPORT_URL_TTL_SECONDS,
  exportDownloadOptions,
} from './constants';

/**
 * The parts of a cached export record this module reads and writes.
 *
 * Declared structurally rather than importing either pipeline's record type, so
 * the shared delivery code does not depend on the pipelines that use it. Each
 * pipeline's own zod schema is what validates the record; this describes only
 * the fields the refresh touches.
 */
export interface RefreshableExportRecord {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileName?: string;
  signedUrl?: string;
  urlExpiresAt?: string;
}

/**
 * Sign an attachment-serving download URL for an export's stored file.
 *
 * This uses the service-role client. Every `storage.objects` policy scopes to
 * `bucket_id = 'assets'`, so a caller-scoped client cannot sign in
 * {@link EXPORTS_BUCKET}. The caller settles authorization first.
 *
 * This throws on failure, so each caller decides what a failed signature costs.
 *
 * @param filePath - Object key inside {@link EXPORTS_BUCKET}. Each pipeline owns
 *   its own key format.
 * @param fileName - Name the browser saves the object under.
 * @returns The signed URL, which asks Supabase for an attachment.
 * @throws The Supabase storage error, or an `Error` when Supabase reports
 *   neither data nor an error.
 */
export const signExportDownloadUrl = async ({
  filePath,
  fileName,
}: {
  filePath: string;
  fileName: string;
}): Promise<string> => {
  const supabase = createSBServiceClient();
  const { data, error } = await supabase.storage
    .from(EXPORTS_BUCKET)
    .createSignedUrl(
      filePath,
      EXPORT_URL_TTL_SECONDS,
      exportDownloadOptions(fileName),
    );

  if (error || !data) {
    throw error ?? new Error('Signing returned no URL');
  }

  return data.signedUrl;
};

/**
 * Does a stored signed URL ask Supabase for an attachment?
 *
 * {@link exportDownloadOptions} sets a `download` query parameter. That
 * parameter makes the file save instead of render. Expiry alone therefore does
 * not report whether a stored URL still works.
 *
 * @param signedUrl - Stored signed URL, or undefined on a record that holds
 *   none.
 * @returns True when the URL carries the `download` parameter.
 */
const servesAsAttachment = (signedUrl: string | undefined): boolean => {
  if (signedUrl === undefined) {
    return false;
  }

  const query = signedUrl.split('?')[1];

  return query !== undefined && new URLSearchParams(query).has('download');
};

/**
 * The margin within which this module treats a URL as already lapsed.
 *
 * Without a margin, a URL with seconds left passes as fresh. The client then
 * receives it, and it answers 400 when the reader clicks. The reader sees no
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
 *
 * @param record - The cached record. Only a completed run has a URL to judge.
 * @returns True when the caller should sign a new URL.
 */
const needsFreshUrl = ({
  status,
  fileName,
  signedUrl,
  urlExpiresAt,
}: RefreshableExportRecord): boolean => {
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
 * The signing-failure messages that mean the file is gone.
 *
 * This build answers "Object not found" even for a missing bucket. storage-api
 * has a distinct `NoSuchBucket` that reads "Bucket not found".
 */
const PERMANENT_SIGNING_FAILURES = ['Object not found', 'Bucket not found'];

/**
 * Reports whether a signing failure means the file is gone for good.
 *
 * The check matches on the message because nothing else separates the two
 * cases. This Supabase build answers `status` 400 for every signing failure,
 * and supplies no error code.
 *
 * Either wording in {@link PERMANENT_SIGNING_FAILURES} means the file is
 * unreachable. A wording this check misses falls to the retryable branch, which
 * is the safe direction.
 *
 * @param error - What the signing call threw. Typed `unknown` because a caught
 *   value carries no guarantee, and Supabase throws a plain object here.
 * @returns True when the message names a missing object or a missing bucket.
 */
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

/**
 * Re-sign a stale export URL in place and cache the result.
 *
 * A still-good URL stays as it is. A failed signature drops the URL from the
 * record, because the bucket is private and a lapsed signature is a dead link
 * rather than a degraded one. It also leaves the cache alone, so the client's
 * retry re-reads a record still marked `completed`.
 *
 * A failed cache write still returns the fresh URL. The next read re-signs.
 *
 * A completed record with no file name is terminal, and handled here rather
 * than skipped by the caller.
 *
 * @param record - The parsed record. Mutated in place, so the caller can return
 *   the same object.
 * @param exportId - The run this record describes. Logging only.
 * @param resolveFilePath - Builds the object key from the record's file name.
 *   Each pipeline owns its own key format, and only a record that carries a file
 *   name has a key at all.
 * @param cacheKey - Key to write the refreshed record back under.
 */
export const refreshStaleSignedUrl = async ({
  record,
  exportId,
  resolveFilePath,
  cacheKey,
}: {
  record: RefreshableExportRecord;
  exportId: string;
  resolveFilePath: (fileName: string) => string;
  cacheKey: string;
}): Promise<void> => {
  const { fileName } = record;

  if (!fileName) {
    if (record.status === 'completed') {
      // A workflow writes `fileName` and `completed` in one update, so this
      // branch should not run. Reaching it means another writer disagrees with
      // the workflow.
      //
      // This reports a terminal failure rather than passing the record over.
      // Returning the record untouched reads to the client as a completed export
      // it can retry, and every retry lands back here. The control would never
      // resolve and never clear. Without a file name there is nothing to sign,
      // and no later read supplies one.
      logger.error('Completed export has no file name', { exportId });

      record.status = 'failed';
      record.signedUrl = undefined;
    }

    return;
  }

  if (!needsFreshUrl(record)) {
    return;
  }

  logger.info('Refreshing signed URL', { exportId });

  // Broad on purpose: this is a degradation boundary, not error handling. A
  // failed re-sign costs the caller the download link. An escaped throw costs
  // the whole record, which sends the control to its error boundary.
  // `createSBServiceClient` throws synchronously, so it is inside the try.
  try {
    record.signedUrl = await signExportDownloadUrl({
      filePath: resolveFilePath(fileName),
      fileName,
    });
    record.urlExpiresAt = new Date(
      Date.now() + EXPORT_URL_TTL_SECONDS * 1000,
    ).toISOString();

    await set(cacheKey, record, EXPORT_CACHE_TTL_SECONDS);
  } catch (error) {
    logger.error('Failed to re-sign export URL', { exportId, error });

    // The lapsed URL does not go back on the record, whatever failed. It
    // renders as a download that answers 400.
    record.signedUrl = undefined;

    // A missing object is permanent for this record. A retry fails the same
    // way, so this reports a terminal failure and the reader starts a fresh run.
    // Without it, a record whose file is gone offers a retry that never
    // succeeds until the 24 hour time-to-live (TTL) expires.
    //
    // Any other failure may be momentary. The run succeeded and the object
    // remains in the bucket, so the record stays `completed` with no URL. The
    // client offers a retry for that state.
    //
    // A terminal failure there would make the client discard the export id, and
    // cost a re-run of the whole export.
    //
    // This leaves the cached record alone either way, so a retry re-reads a
    // record still marked `completed`.
    if (isPermanentlyGone(error)) {
      record.status = 'failed';
    }
  }
};
