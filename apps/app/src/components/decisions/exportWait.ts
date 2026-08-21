/**
 * How long the proposals CSV export waits to be told it has finished.
 *
 * The export is a background workflow, so the mutation only returns an id. The
 * workflow broadcasts on `proposalExport:<exportId>` when it picks the job up
 * and again when the run settles, and the button re-reads its status on each —
 * there is no polling, so this timeout is the only bound on the wait. The
 * button re-arms it per reported state rather than applying it to the whole run.
 *
 * That makes it the last line of defence rather than a formality. A broadcast
 * that never arrives — the workflow died without writing a terminal status, the
 * socket dropped at the wrong moment — leaves nothing else to end the wait, so
 * the failure has to be reported rather than left spinning.
 */
export const EXPORT_WAIT_TIMEOUT_MS = 2 * 60 * 1000;
