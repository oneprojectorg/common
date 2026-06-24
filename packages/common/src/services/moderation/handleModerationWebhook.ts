import { createHash } from 'node:crypto';

import { timingSafeStringEqual } from './providers/verify';
import type { ModerationProvider } from './types';

/** Constant-time secret comparison so the check can't be used as a timing
 *  oracle to recover the shared secret. Delegates to the shared
 *  `timingSafeStringEqual` (one timing-safe primitive for the package); the
 *  length check inside it leaks only the length, never the contents. */
const secretsMatch = (provided?: string, expected?: string): boolean => {
  if (!provided || !expected) {
    return false;
  }
  return timingSafeStringEqual(provided, expected);
};

export interface HandleModerationWebhookInput {
  rawBody: string;
  headers: Record<string, string>;
  /** Secret presented by the caller (from the callback URL / a header). */
  providedSecret?: string;
}

export interface RecordWebhookDeliveryInput {
  provider: string;
  deliveryId: string;
  rawBody: string;
  headers: Record<string, string>;
}

export interface HandleModerationWebhookDeps {
  /** Our configured shared secret; the callback must match it. */
  expectedSecret?: string;
  provider: ModerationProvider | null;
  /** Names the active vendor for the inbox row's provider column; pinned in
   *  config (provider.ts) and passed through here so the persistence layer
   *  doesn't have to read env. */
  providerName?: string;
  /** Persists the delivery and (when the inbox row is still pending) emits
   *  the dispatch workflow event. The route always 200s regardless of which
   *  branch ran — the redelivery dedupe lives in the persistence layer. */
  recordDelivery: (input: RecordWebhookDeliveryInput) => Promise<void>;
}

export type ModerationWebhookResult = {
  status: 200 | 401 | 503;
};

/**
 * Front door for inbound provider webhooks. Verifies the shared secret in the
 * callback URL (all vendors) and the vendor's own signature when it documents
 * one (`provider.verifyWebhook` — Checkstep and Lasso sign; Hive doesn't),
 * then hands the raw payload to `recordDelivery` for inbox persistence + the
 * dispatch event. Parsing and verdict application happen in the workflow, so
 * this function returns to the vendor in DB-write + event-emit time — well
 * under the 10 s budgets where Lasso/Checkstep/Hive abandon and retry.
 *
 *  - secret missing/mismatched     → 401 (nothing persisted)
 *  - vendor signature invalid      → 401
 *  - no provider configured        → 503
 *  - persisted + dispatched (or duplicate redelivery) → 200
 *
 * Parse errors are no longer returned to the vendor: the raw body is in the
 * inbox and the dispatch workflow surfaces failures internally instead of
 * tripping a 400 on schema drift the vendor would just retry.
 */
export const handleModerationWebhook = async (
  input: HandleModerationWebhookInput,
  deps: HandleModerationWebhookDeps,
): Promise<ModerationWebhookResult> => {
  if (!secretsMatch(input.providedSecret, deps.expectedSecret)) {
    return { status: 401 };
  }

  if (!deps.provider) {
    return { status: 503 };
  }

  if (
    deps.provider.verifyWebhook &&
    !deps.provider.verifyWebhook({
      rawBody: input.rawBody,
      headers: input.headers,
    })
  ) {
    return { status: 401 };
  }

  await deps.recordDelivery({
    provider: deps.providerName ?? 'unknown',
    deliveryId: deliveryIdFor(input.rawBody),
    rawBody: input.rawBody,
    headers: input.headers,
  });

  return { status: 200 };
};

/** SHA-256 of the raw body. Vendor-agnostic, computable before parsing, and
 *  identical across a redelivery of the same payload — exactly the property
 *  the inbox's unique `(provider, deliveryId)` index needs to dedupe retries. */
export const deliveryIdFor = (rawBody: string): string =>
  createHash('sha256').update(rawBody, 'utf8').digest('hex');
