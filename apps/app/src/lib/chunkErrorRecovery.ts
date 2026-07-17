// After a deploy, old JS/CSS chunk hashes are invalidated. A user on a stale
// build who navigates or lazy-loads a chunk that no longer exists hits a
// ChunkLoadError. Recovery is a full page reload to pull the latest assets,
// guarded so a genuinely missing chunk can't reload the page forever.

const CHUNK_ERROR_PATTERNS = [
  /Loading chunk [^\s]+ failed/i,
  /Loading CSS chunk [^\s]+ failed/i,
  /ChunkLoadError/i,
];

export const isChunkLoadError = (error: unknown): boolean => {
  if (error == null) {
    return false;
  }

  if (error instanceof Error && error.name === 'ChunkLoadError') {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);

  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

const RELOAD_MARKER_KEY = 'chunk-error-reloaded-at';
// A fresh reload loads new chunks within a couple of seconds; if a chunk error
// recurs inside this window the chunk is truly gone, so we stop reloading and
// let the error surface. A later deploy in the same long-lived session falls
// outside the window and recovers again.
const RELOAD_COOLDOWN_MS = 10_000;

// Returns true when a reload was triggered, false when suppressed by the guard.
export const reloadForChunkError = (): boolean => {
  const now = Date.now();

  try {
    const stored = window.sessionStorage.getItem(RELOAD_MARKER_KEY);
    const lastReloadAt = stored ? Number(stored) : null;

    if (lastReloadAt && now - lastReloadAt < RELOAD_COOLDOWN_MS) {
      return false;
    }

    window.sessionStorage.setItem(RELOAD_MARKER_KEY, String(now));
  } catch {
    // Without a durable marker we can't guarantee the reload won't loop, so
    // leave the page as-is and let the error boundary handle it.
    return false;
  }

  window.location.reload();

  return true;
};
