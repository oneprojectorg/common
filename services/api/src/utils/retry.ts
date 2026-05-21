/**
 * Calls `fn` up to `retries` times, waiting `baseMs * attempt` between tries.
 * Stops as soon as `fn` returns a defined value. Returns `undefined` if every
 * attempt resolved to `undefined`.
 *
 * Linear backoff (not exponential) — these retries exist to absorb short
 * replication lag, not to ride out outages.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T | undefined>,
  { retries, baseMs }: { retries: number; baseMs: number },
): Promise<T | undefined> {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const result = await fn();
    if (result !== undefined) {
      return result;
    }

    if (attempt < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, baseMs * (attempt + 1)));
    }
  }

  return undefined;
}
