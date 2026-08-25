/**
 * What a "Retry download" click does, for each result of re-reading the export
 * record.
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

export const resolveExportRetryOutcome = ({
  errored,
  status,
  signedUrl,
}: {
  /** The re-read failed as a request, rather than returning a record. */
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
