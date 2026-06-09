export interface RetryOptions {
  /** Max retries *after* the first attempt (default 2 → up to 3 tries). */
  retries?: number;
  /** Base delay before the first retry, in ms (default 200). */
  minDelayMs?: number;
  /** Upper bound on any single delay, in ms (default 2000). */
  maxDelayMs?: number;
  /** Backoff multiplier per attempt (default 2). */
  factor?: number;
  /** Decide whether a thrown error is worth retrying (default: always). */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Side-effect hook before each retry sleep (e.g. logging). */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `fn` with exponential backoff + full jitter, retrying on thrown errors.
 *
 * `fn` receives the zero-based attempt number. Only errors `fn` throws are
 * retried — return a value (even a failed Response) to opt a case out of retry.
 * Caps the total at `retries + 1` attempts and rethrows the last error.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    retries = 2,
    minDelayMs = 200,
    maxDelayMs = 2000,
    factor = 2,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let attempt = 0;
  for (;;) {
    try {
      return await fn(attempt);
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error, attempt)) {
        throw error;
      }
      // Full jitter: random point in [0, min(cap, base * factor^attempt)].
      const ceiling = Math.min(maxDelayMs, minDelayMs * factor ** attempt);
      const delayMs = Math.random() * ceiling;
      onRetry?.(error, attempt + 1, delayMs);
      await sleep(delayMs);
      attempt += 1;
    }
  }
}
