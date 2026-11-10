/**
 * How long a background export waits in silence before it re-reads its status.
 *
 * An export is a background workflow, so the start mutation only returns an id.
 * The workflow broadcasts on the export's channel when it picks the job up and
 * again when the run settles, and the client re-reads its status on each. There
 * is no polling, so this period is the only bound on a broadcast that never
 * arrives — the workflow died without writing a terminal status, or the socket
 * dropped at the wrong moment.
 *
 * Each caller decides what silence means. The proposals CSV export gives up
 * after one period. The personal data export re-reads and keeps waiting up to
 * its own cap, because it does all its work in one quiet step.
 */
export const EXPORT_WAIT_TIMEOUT_MS = 2 * 60 * 1000;
