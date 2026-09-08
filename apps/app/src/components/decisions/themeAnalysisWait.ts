/**
 * How long the theme analysis waits before reporting that it gave up.
 *
 * A bound on the whole run, not on silence. The run reports exactly two states
 * before it settles — `pending`, then `processing` within seconds of pickup — so
 * although the timer re-arms on a phase change, in practice it re-arms once and
 * then runs to the end. Calling it a silence bound would overstate it.
 *
 * Sized to sit above the server's own bounds, so the run always gets to say what
 * happened before the client gives up guessing. Each model pass is capped at
 * `THEME_ANALYSIS_PASS_TIMEOUT_MS` (8 minutes) and there are two of them, so a
 * run that is going to fail reports it inside ~16 minutes; this leaves margin
 * on top for the corpus read and the broadcast.
 *
 * Ordering is the whole point: pass timeout < the route's `maxDuration` < this.
 * When the client's bound is the tightest, a facilitator is told "timed out" for
 * runs that were about to succeed, and for runs that failed with a real reason
 * nobody ever sees.
 *
 * There is no polling behind it, so this is the only thing that ends the wait
 * when a broadcast never arrives — the workflow died without writing a terminal
 * status, or the socket dropped at the wrong moment.
 *
 * Overrunning it is not free: the client drops the analysis id, and the finished
 * row sits there with nothing on screen able to address it. Erring long is
 * therefore the cheaper direction.
 */
export const THEME_ANALYSIS_WAIT_TIMEOUT_MS = 25 * 60 * 1000;

/**
 * How often the client re-reads a run that has not reported.
 *
 * A backstop, not the mechanism. The run's realtime channel is still what makes
 * a finished analysis appear at once; this is what makes it appear at all.
 *
 * Broadcasts are best-effort by design — `publishMany` swallows its failures on
 * the reasoning that a client will recover on its next full fetch. That holds
 * for a mutation whose result the user will navigate back to. It does not hold
 * here: this run's result has no other path to the screen, so a broadcast that
 * is dropped, or never published because the publisher had no credentials,
 * leaves the button saying "Preparing..." until the wait above gives up — for a
 * run that finished minutes ago and is sitting in the cache.
 *
 * Five seconds because the whole run is on the order of a minute or two, and the
 * read is a single cache lookup. Polling stops the moment the run settles: the
 * status query disables itself, and a disabled query does not poll.
 */
export const THEME_ANALYSIS_POLL_INTERVAL_MS = 5 * 1000;
