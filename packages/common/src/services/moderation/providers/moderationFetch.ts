import { withRetry } from '@op/core';

const DEFAULT_TIMEOUT_MS = 5_000;

/** Per-call retry/timeout budget. */
export interface ModerationFetchOptions {
  /** Max retries after the first attempt (defaults to withRetry's default). */
  retries?: number;
  /** Per-attempt request timeout in ms. */
  timeoutMs?: number;
}

/**
 * The synchronous gate blocks a user write, so it must stay snappy: one retry
 * and a short per-attempt timeout cap the worst-case block at a few seconds
 * during a provider brownout. The async review path leaves the budget at the
 * defaults, where a slower-but-surer result is fine.
 */
export const SYNC_GATE_FETCH: ModerationFetchOptions = {
  retries: 1,
  timeoutMs: 3_000,
};

/** 429 and 5xx are transient; other 4xx (bad key/request) won't fix on retry. */
const isRetryableStatus = (status: number): boolean =>
  status === 429 || status >= 500;

/**
 * POSTs to a moderation provider with exponential backoff. Retries network
 * errors, timeouts, and 429/5xx responses; returns non-retryable responses
 * (e.g. 4xx) to the caller untouched. A fresh timeout signal is created per
 * attempt. The URL/key never appear in the thrown error.
 */
export const moderationFetch = async (
  url: string,
  init: Omit<RequestInit, 'signal'>,
  { retries, timeoutMs = DEFAULT_TIMEOUT_MS }: ModerationFetchOptions = {},
): Promise<Response> => {
  return withRetry(
    async () => {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok && isRetryableStatus(response.status)) {
        // Throw to trigger a retry; status only, never the URL/key.
        throw new Error(`Moderation provider returned ${response.status}`);
      }

      return response;
    },
    { retries },
  );
};
