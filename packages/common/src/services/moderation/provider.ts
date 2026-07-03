import { z } from 'zod';

import { createCheckstepProvider } from './providers/checkstep';
import type { ModerationCategory, ModerationProvider } from './types';

const MODERATION_CATEGORIES = [
  'profanity',
  'sexual',
  'hate',
  'violence',
  'harassment',
  'csam',
  'other',
] as const satisfies readonly ModerationCategory[];

// `MODERATION_POLICY_MAP` is a JSON object: `{ "HTE": "hate", ... }`. The
// value must be one of our `ModerationCategory` union members; anything else
// fails validation so a typo in ops config fails loudly at startup instead of
// silently miscategorising violations.
const policyMapSchema = z.record(z.string(), z.enum(MODERATION_CATEGORIES));

const parsePolicyMap = (
  raw: string | undefined,
): Record<string, ModerationCategory> | undefined => {
  if (!raw?.trim()) {
    return undefined;
  }
  const parsed = policyMapSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(
      `Invalid MODERATION_POLICY_MAP: ${parsed.error.issues[0]?.message ?? 'bad shape'}`,
    );
  }
  return parsed.data;
};

const parseDetachPolicies = (raw: string | undefined): string[] | undefined => {
  if (!raw?.trim()) {
    return undefined;
  }
  const codes = raw
    .split(',')
    .map((code) => code.trim())
    .filter((code) => code.length > 0);
  return codes.length > 0 ? codes : undefined;
};

/**
 * Resolves the Checkstep moderation provider. Keyed by `MODERATION_API_KEY`;
 * `MODERATION_WEBHOOK_SIGNING_KEY` carries the Checkstep platform signing key
 * used to verify inbound webhooks. When set, every callback must present a
 * valid `x-auth-signature`.
 *
 * `MODERATION_POLICY_MAP` (JSON) and `MODERATION_DETACH_POLICIES` (comma
 * list) override the Checkstep policy → category taxonomy and the
 * mandatory-detach code set. Both are optional; without them the adapter
 * falls back to sensible defaults. Because Checkstep policies are configured
 * per-account, keeping these in env lets the deployment's real taxonomy drive
 * detection without a code change.
 *
 * Returns `null` when moderation isn't configured (no key) — the feature is
 * simply off. `MODERATION_PROVIDER` is accepted only as `checkstep` (or empty);
 * a non-empty value that isn't `checkstep` throws so a stale config fails
 * loudly rather than silently disabling moderation.
 */
export const getModerationProvider = (): ModerationProvider | null => {
  const vendor = process.env.MODERATION_PROVIDER;
  const apiKey = process.env.MODERATION_API_KEY;
  const webhookSigningKey = process.env.MODERATION_WEBHOOK_SIGNING_KEY;
  if (!apiKey) {
    return null;
  }

  if (vendor && vendor !== 'checkstep') {
    throw new Error(`Unknown MODERATION_PROVIDER: ${vendor}`);
  }

  return createCheckstepProvider({
    apiKey,
    webhookSigningKey,
    policyMap: parsePolicyMap(process.env.MODERATION_POLICY_MAP),
    detachPolicies: parseDetachPolicies(process.env.MODERATION_DETACH_POLICIES),
  });
};
