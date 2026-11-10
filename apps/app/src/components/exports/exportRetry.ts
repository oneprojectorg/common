/**
 * Union of the four things re-reading a finished export's record can mean, when
 * the user asks for its file again.
 *
 * Shared by the proposals CSV export and the personal data export. The helper
 * only names the outcome; each caller decides what to report for it.
 *
 * This lives apart from the components so a test can drive the four outcomes
 * directly. `apps/app` runs Vitest under `environment: 'node'`, and this
 * workspace installs no DOM, so it supports no component test.
 *
 * The outcome that matters most also never appears in a happy-path render. The
 * client must refuse to retire an export id it cannot prove is gone.
 */
export type ExportRetryOutcome =
  /** The server minted a URL. The caller can hand over the file. */
  | 'recovered'
  /**
   * The run failed. Only a new export helps. A caller that already reported the
   * failure when the run settled should not report it twice.
   */
  | 'run-failed'
  /**
   * The record is absent, because it aged out of its 24 hour life. Nothing
   * returns it, so the caller should retire the id rather than wait on it.
   */
  | 'record-gone'
  /**
   * The read did not settle. A request failed, or signing failed, or the run is
   * still in flight. Report it and keep the export id. The object is most
   * likely still in the bucket, and discarding the only handle to it costs a
   * whole re-export.
   */
  | 'still-unavailable';

/**
 * Decides what a "Retry download" click amounted to, from the re-read it
 * produced.
 *
 * A pure function of one refetch result, so it takes the three fields that
 * decide the answer rather than the query result itself. The caller reports the
 * outcome and, for one of the four, retires the export id.
 *
 * Written as "did it recover?" rather than as a list of the ways it can fail. A
 * result this function did not anticipate therefore falls to
 * `'still-unavailable'`, which reports a problem and keeps the id, instead of
 * passing silently.
 *
 * @param errored - The re-read failed as a request, rather than returning a
 *   record.
 * @param status - Status the re-read returned, or undefined when it returned
 *   nothing.
 * @param signedUrl - Signed URL on the returned record, if it carries one. A
 *   `completed` record without one is what the retry exists for.
 * @returns Which of the four {@link ExportRetryOutcome} cases this read is.
 */
export const resolveExportRetryOutcome = ({
  errored,
  status,
  signedUrl,
}: {
  errored: boolean;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'not_found';
  signedUrl?: string;
}): ExportRetryOutcome => {
  if (!errored && status === 'completed' && signedUrl) {
    return 'recovered';
  }

  if (status === 'failed') {
    return 'run-failed';
  }

  // Only an answered read proves absence. `errored` covers a server that could
  // not reach the cache. `getExportStatus` throws in that case, so it no longer
  // arrives here as `not_found`.
  if (!errored && status === 'not_found') {
    return 'record-gone';
  }

  return 'still-unavailable';
};
