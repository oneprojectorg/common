// Keyed on `${ip}-${reqUrl}`, so every entry holds a caller's raw IP. That is
// defensible while the window is open — it is what the rate limit counts
// against — but an entry nobody sweeps is retained personal data with no
// purpose (GDPR Art. 5(1)(c)), so expired windows are evicted rather than left
// to accumulate for the lifetime of the process.
const windows = new Map<string, { accessCount: number; expiresAt: number }>();

// Sweeping on a cadence rather than on every call keeps the O(entries) scan off
// the hot path; an entry survives its window by at most this long.
const SWEEP_INTERVAL_MS = 60_000;

let nextSweepAt = 0;

const rateLimited = (
  ip: string,
  reqUrl: string,
  windowSize = 10,
  maxRequests = 10,
) => {
  const now = Date.now();

  sweepExpiredWindows(now);

  // Unique key based on path and IP
  const key = `${ip}-${reqUrl}`;
  const openWindow = windows.get(key);
  const currentWindow =
    openWindow && openWindow.expiresAt > now
      ? openWindow
      : { accessCount: 0, expiresAt: now + windowSize * 1000 };

  const timeToRefresh = currentWindow.expiresAt - now;

  if (currentWindow.accessCount >= maxRequests) {
    return { status: true, timeToRefresh };
  }

  windows.set(key, {
    accessCount: currentWindow.accessCount + 1,
    expiresAt: currentWindow.expiresAt,
  });

  return { status: false, timeToRefresh };
};

/**
 * How many client windows are currently held. Exposed so the retention
 * behaviour above is testable — a caller's IP must not outlive its window.
 */
export const trackedWindowCount = () => windows.size;

const sweepExpiredWindows = (now: number) => {
  if (now < nextSweepAt) {
    return;
  }

  nextSweepAt = now + SWEEP_INTERVAL_MS;

  for (const [key, openWindow] of windows) {
    if (openWindow.expiresAt <= now) {
      windows.delete(key);
    }
  }
};

export default rateLimited;
