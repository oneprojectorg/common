/**
 * Polling policy for the proposals CSV export.
 *
 * Kept out of the component so the terminal-vs-keep-going decision is testable:
 * getting it wrong is either an export that never stops polling or a spinner
 * that never resolves, and neither is visible until it happens in production.
 */

/**
 * The export is a background workflow, so the mutation only returns an id and
 * the file arrives via polling. 2.5s matches the document-load poll elsewhere in
 * the decision UI — responsive on a small instance without hammering the
 * endpoint while a large CSV builds.
 */
export const EXPORT_POLL_INTERVAL_MS = 2500;

/**
 * A workflow that has not reported back by now is treated as lost rather than
 * polled forever. Generous, because generation time scales with proposal count.
 */
export const EXPORT_POLL_TIMEOUT_MS = 2 * 60 * 1000;

/** The shape this policy cares about, structurally — not the full tRPC payload. */
export type ExportPollState = { status: string } | undefined | null;

/**
 * How long until the next poll, or `false` to stop.
 *
 * `not_found` deliberately keeps polling rather than stopping: the status record
 * is written when the export is requested, but a read can land before that write
 * is visible, so treating the first `not_found` as terminal would strand an
 * export that is about to start. The timeout is what bounds this, not the
 * absence of a record.
 */
export const nextExportPollInterval = (
  state: ExportPollState,
): number | false => {
  if (!state) {
    return EXPORT_POLL_INTERVAL_MS;
  }

  switch (state.status) {
    case 'completed':
    case 'failed':
      return false;
    default:
      // pending, processing, not_found, and anything a future server adds:
      // keep polling and let the timeout bound it.
      return EXPORT_POLL_INTERVAL_MS;
  }
};
