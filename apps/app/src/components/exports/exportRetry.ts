/**
 * Union of the four things a "Retry download" click can mean, one per result of
 * re-reading the export record.
 *
 * The variants are string literals rather than an object, because the caller
 * only branches on which one it got. Each carries its reasoning below, which is
 * the point of this module.
 *
 * This lives apart from the component so a test can drive the four outcomes
 * directly. `apps/app` runs Vitest under `environment: 'node'`, and this
 * workspace installs no DOM, so it supports no component test.
 *
 * The outcome that matters most also never appears in a happy-path render. The
 * client must refuse to retire an export id it cannot prove is gone.
 */
export type ExportRetryOutcome =
  /** The server minted a URL. The download is on screen. Report nothing. */
  | 'recovered'
  /**
   * The run failed. The `isFailed` effect already shows a toast and resets the
   * button. A second message would duplicate it, and would also misdescribe it:
   * that state needs a fresh export, not another retry.
   */
  | 'failure-already-reported'
  /**
   * The record is absent, because it aged out of its 24 hour life. Nothing
   * returns it. Holding the id would set `isRunning` back to true, revert the
   * label to "Preparing...", and time out a run that finished.
   */
  | 'record-gone'
  /**
   * The read did not settle. A request failed, or signing failed, or the run is
   * still in flight. Report it and keep the export id. The object is most
   * likely still in the bucket, and discarding the only handle to it costs a
   * re-export of up to a thousand proposals.
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
    return 'failure-already-reported';
  }

  // Only an answered read proves absence. `errored` covers a server that could
  // not reach the cache. `getExportStatus` throws in that case, so it no longer
  // arrives here as `not_found`.
  if (!errored && status === 'not_found') {
    return 'record-gone';
  }

  return 'still-unavailable';
};
