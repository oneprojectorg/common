import { createHash, createHmac } from 'node:crypto';
import { z } from 'zod';

import { decodeContentRef, encodeContentRef } from '../contentRef';
import type {
  ModerationCategory,
  ModerationMediaItem,
  ModerationProvider,
  ModerationProviderReference,
  ModerationScores,
  ModerationVerdict,
  ModerationWebhookInput,
} from '../types';
import {
  type ModerationFetchOptions,
  SYNC_GATE_FETCH,
  moderationFetch,
} from './moderationFetch';
import { headerValue, timingSafeStringEqual } from './verify';

// External input driving DB writes: validate the shape instead of casting.
// `decision` stays a plain string — an unrecognized Checkstep decision must
// not 400 the webhook; it just doesn't count as flagging.
const checkstepWebhookSchema = z.object({
  id: z.string(),
  decision: z.string().nullish(),
  violations: z
    .array(
      z.object({
        policy: z.string().nullish(),
        severity: z.string().nullish(),
      }),
    )
    .nullish(),
});

const DEFAULT_API_URL = 'https://api.checkstep.com/api/v2';
// Reject webhooks whose signed `x-auth-date` is older/newer than this — a
// captured request can't be replayed indefinitely. Generous enough to absorb
// clock skew and provider retry delays.
const WEBHOOK_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Verifies Checkstep's webhook signature (docs.checkstep.com/standard):
 * `x-auth-signature` carries one or more comma-separated HMACs — two during
 * the 24h signing-key rotation window — each computed as
 * `HMAC-SHA256(key, hex(SHA-256("{body}.{date}.{nonce}")))`, hex-encoded.
 * The date and nonce ride in `x-auth-date`/`x-auth-nonce` and are part of the
 * signed content, so a parseable-but-stale date also invalidates the request.
 */
const verifyCheckstepWebhook = (
  { rawBody, headers }: ModerationWebhookInput,
  signingKey: string,
): boolean => {
  const signatureHeader = headerValue(headers, 'x-auth-signature');
  const date = headerValue(headers, 'x-auth-date');
  const nonce = headerValue(headers, 'x-auth-nonce');
  if (!signatureHeader || !date || !nonce) {
    return false;
  }

  const contentHash = createHash('sha256')
    .update(`${rawBody}.${date}.${nonce}`, 'utf8')
    .digest('hex');
  const expected = createHmac('sha256', signingKey)
    .update(contentHash, 'utf8')
    .digest('hex');

  const signatureMatches = signatureHeader
    .split(',')
    .some((candidate) => timingSafeStringEqual(candidate.trim(), expected));
  if (!signatureMatches) {
    return false;
  }

  // Replay window: the date is covered by the signature, so an attacker can't
  // forge a fresh one. An unparseable date is accepted (format isn't pinned by
  // the docs) — the signature has already vouched for the request.
  const signedAt = Date.parse(date);
  if (!Number.isNaN(signedAt)) {
    return Math.abs(Date.now() - signedAt) <= WEBHOOK_MAX_AGE_MS;
  }
  return true;
};

// Checkstep policy codes mapped onto our categories; anything unmapped is `other`.
const POLICY_MAP: Record<string, ModerationCategory> = {
  HTE: 'hate',
  VIO: 'violence',
  SEX: 'sexual',
  HRS: 'harassment',
  PRF: 'profanity',
};

// Checkstep severity buckets mapped onto our 0-1 scale.
const SEVERITY_SCORE: Record<string, number> = {
  low: 0.3,
  medium: 0.6,
  high: 1,
};

interface CheckstepViolation {
  policy?: string | null;
  severity?: string | null;
}

const post = async (
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
  fetchOptions?: ModerationFetchOptions,
): Promise<{ violations?: CheckstepViolation[]; id?: string }> => {
  const response = await moderationFetch(
    url,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    fetchOptions,
  );

  if (!response.ok) {
    throw new Error(`Moderation provider returned ${response.status}`);
  }

  // Checkstep acks an async submission with a success status but an empty body,
  // so `response.json()` would throw "Unexpected end of JSON input". Read the
  // text and only parse when there's something there — both callers tolerate a
  // missing `id`/`violations`.
  const text = await response.text();
  if (!text.trim()) {
    return {};
  }
  return JSON.parse(text);
};

// Checkstep field types we can express per media kind. `other` (PDFs/docs)
// has no reviewable field type, so it's dropped rather than mislabeled as an
// image — the text still covers it.
const CHECKSTEP_FIELD_TYPE: Partial<
  Record<ModerationMediaItem['kind'], string>
> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
};

// Checkstep requires a top-level `type` (its "complex type") on every content
// submission, and ships no preconfigured values — each must be created in the
// account. Ours defines a single complex type, `comment`, so every submission
// uses it. The real item kind (proposal/post/user) is preserved in the encoded
// `id`, which is what routes the verdict back, so collapsing onto one complex
// type here is lossless.
const COMPLEX_TYPE = 'comment';

const contentBody = (
  contentId: string,
  content: string,
  media: ModerationMediaItem[] = [],
  callbackUrl?: string,
) => ({
  id: contentId,
  type: COMPLEX_TYPE,
  fields: [
    { id: 'text', type: 'text', src: content },
    ...media.flatMap((item, index) => {
      const fieldType = CHECKSTEP_FIELD_TYPE[item.kind];
      return fieldType
        ? [{ id: `media-${index}`, type: fieldType, src: item.url }]
        : [];
    }),
  ],
  ...(callbackUrl ? { callback_url: callbackUrl } : {}),
});

// Checkstep review outcomes that mean the content is disallowed.
const FLAGGING_DECISIONS: readonly string[] = ['act', 'uphold', 'escalate'];
// Outcomes that explicitly clear the content. An unrecognized or missing
// decision is neither — it's treated as "not a verdict" (no action) rather
// than defaulting to clear, so vendor schema drift can't silently un-hide
// flagged content.
const CLEARING_DECISIONS: readonly string[] = [
  'dismiss',
  'allow',
  'ignore',
  'clear',
];

const scoresFromViolations = (
  violations: CheckstepViolation[] | undefined,
): ModerationScores => {
  if (!Array.isArray(violations)) {
    return {};
  }
  const scores: ModerationScores = {};
  for (const violation of violations) {
    const category: ModerationCategory =
      (violation.policy ? POLICY_MAP[violation.policy] : undefined) ?? 'other';
    const score = violation.severity
      ? (SEVERITY_SCORE[violation.severity] ?? 0.5)
      : 0.5;
    scores[category] = Math.max(scores[category] ?? 0, score);
  }
  return scores;
};

/**
 * Checkstep moderation adapter. A platform vendor with policy-based violations,
 * a dashboard, and native appeals — implements `submitForReview` for the async
 * path. Key/URL never leak in errors.
 */
export const createCheckstepProvider = ({
  apiKey,
  apiUrl = DEFAULT_API_URL,
  webhookSigningKey,
}: {
  apiKey: string;
  apiUrl?: string;
  /** Platform signing key from Checkstep settings; when set, inbound webhooks
   *  must carry a valid `x-auth-signature`. */
  webhookSigningKey?: string;
}): ModerationProvider => ({
  ...(webhookSigningKey
    ? {
        verifyWebhook: (input: ModerationWebhookInput) =>
          verifyCheckstepWebhook(input, webhookSigningKey),
      }
    : {}),

  scoreText: async ({ content }) => {
    const result = await post(
      `${apiUrl}/content/sync`,
      apiKey,
      contentBody(crypto.randomUUID(), content),
      SYNC_GATE_FETCH,
    );
    return scoresFromViolations(result.violations);
  },

  // Checkstep takes one combined task (text + media fields), so it's a
  // single ref — unless there's nothing to review (no text, no media, e.g. a
  // `user` flag), in which case no task is planned and the flag stays pending
  // for manual handling rather than being auto-cleared by an empty submission
  // (matches Hive's behavior).
  planReviewRefs: ({ itemType, itemId, roundId, content, media }) =>
    content.trim() || (media?.length ?? 0) > 0
      ? [encodeContentRef(itemType, itemId, roundId)]
      : [],

  submitForReview: async ({
    itemType,
    itemId,
    roundId,
    content,
    media,
    callbackUrl,
  }) => {
    const contentId = encodeContentRef(itemType, itemId, roundId);
    const result = await post(
      `${apiUrl}/content`,
      apiKey,
      contentBody(contentId, content, media, callbackUrl),
    );
    const reference: ModerationProviderReference = {
      providerRecordId: result.id ?? contentId,
      submittedRefs: [contentId],
    };
    return reference;
  },

  // One verdict per callback (one combined task per submission).
  parseWebhook: ({ rawBody }: ModerationWebhookInput): ModerationVerdict[] => {
    const payload = checkstepWebhookSchema.parse(JSON.parse(rawBody));
    // A delivery for content not ingested through this integration (dashboard
    // test payloads, sync-gate items under a bare uuid, pre-deploy content)
    // carries an id that isn't our ref — skip it and acknowledge with 200,
    // matching the Lasso adapter, rather than throwing into a 400 + retries.
    let ref;
    try {
      ref = decodeContentRef(payload.id);
    } catch {
      return [];
    }
    const flagged = payload.decision
      ? FLAGGING_DECISIONS.includes(payload.decision)
      : false;
    const cleared = payload.decision
      ? CLEARING_DECISIONS.includes(payload.decision)
      : false;
    // Neither a flagging nor a recognized clearing decision (unknown value, or
    // a decision-less ack/interim callback) → not a verdict; emit nothing
    // rather than defaulting to clear and dismissing an open flag.
    if (!flagged && !cleared) {
      return [];
    }
    return [
      {
        itemType: ref.itemType,
        itemId: ref.itemId,
        roundId: ref.roundId,
        mediaId: ref.mediaId,
        verdict: flagged ? 'flagged' : 'clear',
        externalRecordId: payload.id,
        reason: flagged ? `Checkstep decision: ${payload.decision}` : undefined,
        scores: flagged
          ? scoresFromViolations(payload.violations ?? undefined)
          : undefined,
      },
    ];
  },
});
