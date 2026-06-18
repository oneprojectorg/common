import { timingSafeStringEqual } from './providers/verify';
import type { ModerationProvider, ModerationVerdict } from './types';

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

export interface HandleModerationWebhookDeps {
  /** Our configured shared secret; the callback must match it. */
  expectedSecret?: string;
  provider: ModerationProvider | null;
  applyVerdict: (verdict: ModerationVerdict) => Promise<unknown>;
}

export type ModerationWebhookResult = {
  status: 200 | 400 | 401 | 503;
};

/**
 * Verifies, parses, and applies an inbound provider webhook. Two gates: the
 * shared secret we put in the callback URL (all vendors), and the vendor's own
 * webhook signature when it documents one (`provider.verifyWebhook` —
 * Checkstep and Lasso sign; Hive doesn't). Returns an HTTP status for the
 * route to echo; never throws on bad input.
 *
 *  - secret missing/mismatched     → 401 (nothing parsed, DB untouched)
 *  - vendor signature invalid      → 401
 *  - no provider configured        → 503
 *  - unparseable payload           → 400
 *  - parsed + applied              → 200
 */
export const handleModerationWebhook = async (
  input: HandleModerationWebhookInput,
  deps: HandleModerationWebhookDeps,
): Promise<ModerationWebhookResult> => {
  if (!secretsMatch(input.providedSecret, deps.expectedSecret)) {
    return { status: 401 };
  }

  if (!deps.provider?.parseWebhook) {
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

  let verdicts: ModerationVerdict[];
  try {
    verdicts = deps.provider.parseWebhook({
      rawBody: input.rawBody,
      headers: input.headers,
    });
  } catch {
    return { status: 400 };
  }

  // A delivery can carry zero verdicts (e.g. Lasso's webhook also delivers
  // tag/strike/list actions): acknowledge it so the vendor doesn't retry.
  for (const verdict of verdicts) {
    await deps.applyVerdict(verdict);
  }
  return { status: 200 };
};
