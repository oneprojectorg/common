/**
 * How long the theme analysis waits before reporting that it gave up.
 *
 * A bound on the whole run, not on silence. The run reports exactly two states
 * before it settles — `pending`, then `processing` within seconds of pickup — so
 * although the timer re-arms on a phase change, in practice it re-arms once and
 * then runs to the end. Calling it a silence bound would overstate it.
 *
 * Sized for what the run actually does: a corpus read over up to a hundred
 * proposals, then two sequential model calls on prompts of roughly 130 KB, and
 * the workflow's one retry has to fit inside this too, or a run that failed for
 * a reportable reason is reported as a timeout instead.
 *
 * There is no polling behind it, so this is the only thing that ends the wait
 * when a broadcast never arrives — the workflow died without writing a terminal
 * status, or the socket dropped at the wrong moment.
 *
 * Overrunning it is not free: the client drops the analysis id, and the finished
 * record stays in the cache for a day with nothing able to address it. Erring
 * long is therefore the cheaper direction.
 */
export const THEME_ANALYSIS_WAIT_TIMEOUT_MS = 10 * 60 * 1000;
