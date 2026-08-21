/**
 * What a "Retry download" click should do, given what re-reading the export
 * record returned.
 *
 * Kept apart from the component so the four outcomes can be tested directly:
 * `apps/app` runs Vitest under `environment: 'node'`, so a component test would
 * need a DOM this workspace does not install, and the branch that matters most
 * here — refusing to retire an export id the client cannot prove is gone — is
 * exactly the one that never fires in a happy-path render.
 */
export type ExportRetryOutcome =
  /** A URL was minted. The download is on screen; say nothing. */
  | { kind: 'recovered' }
  /**
   * The run itself failed. The `isFailed` effect already toasts and resets the
   * button, so a second message here would duplicate it — and misdescribe it,
   * since that state needs a fresh export rather than another retry.
   */
  | { kind: 'failure-already-reported' }
  /**
   * The record is genuinely absent: it aged out of its 24h life. Nothing will
   * bring it back, and holding the id would flip `isRunning` back to true —
   * reverting to "Preparing..." and eventually timing out a run that finished.
   */
  | { kind: 'record-gone' }
  /**
   * Something stopped the read from settling — a failed request, a signing
   * error, a record still in flight. Report it, but keep the export id: the
   * object is most likely still in the bucket, and discarding the only handle
   * to it costs a re-export of up to a thousand proposals.
   */
  | { kind: 'still-unavailable' };

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
    return { kind: 'recovered' };
  }

  if (status === 'failed') {
    return { kind: 'failure-already-reported' };
  }

  // Only an answered read proves absence. `errored` covers the case where the
  // server could not reach the cache at all, which now arrives as a thrown
  // error rather than as `not_found` — see `getExportStatus`.
  if (!errored && status === 'not_found') {
    return { kind: 'record-gone' };
  }

  return { kind: 'still-unavailable' };
};
