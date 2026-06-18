import { createHmac } from 'node:crypto';
import { z } from 'zod';

import { decodeContentRef, encodeContentRef } from '../contentRef';
import type {
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

const DEFAULT_API_URL = 'https://api.lassomoderation.com/api/v1';

/**
 * Verifies Lasso's webhook signature (docs.lassomoderation.com/webhooks):
 * `X-Lasso-Signature` is `sha256=` + base64(HMAC-SHA256(secret, raw body)).
 * Lasso documents no timestamp/nonce, so replay protection rests on the
 * update-only verdict recording (a replayed verdict re-lands on the same task
 * row, or finds nothing once the round is cleared).
 */
const verifyLassoWebhook = (
  { rawBody, headers }: ModerationWebhookInput,
  signingKey: string,
): boolean => {
  const signature = headerValue(headers, 'x-lasso-signature');
  if (!signature) {
    return false;
  }
  const expected = `sha256=${createHmac('sha256', signingKey)
    .update(rawBody, 'utf8')
    .digest('base64')}`;
  return timingSafeStringEqual(signature.trim(), expected);
};
// Lasso returns an allow/block verdict rather than per-category scores; a block
// maps to a decisive score that meets the summed gate threshold on its own.
const BLOCK_SCORE = 1;

/** Lasso's verdict for a piece of content. */
type LassoStatus = 'allowed' | 'flagged' | 'hidden';
/** Verdicts where Lasso's rules acted on the content (i.e. it's disallowed). */
const BLOCKING_STATUSES: readonly LassoStatus[] = ['flagged', 'hidden'];
/** The status `allowed` is the only recognized non-blocking verdict. */
const CLEARING_STATUSES: readonly LassoStatus[] = ['allowed'];

const isBlockingStatus = (status: string | null | undefined): boolean =>
  BLOCKING_STATUSES.some((blocking) => blocking === status);

/** A status we actually understand as a verdict. An unrecognized value (vendor
 *  schema drift, a new status) is NOT treated as a verdict — emitting nothing
 *  fails safe (content stays as-is) instead of defaulting to clear, which
 *  would silently un-hide flagged content. */
const isRecognizedStatus = (status: string | null | undefined): boolean =>
  isBlockingStatus(status) ||
  CLEARING_STATUSES.some((clearing) => clearing === status);

// Lasso caps `text` at 4000 chars (docs: POST /content); longer submissions
// would be rejected outright, so truncate instead.
const LASSO_MAX_TEXT_LENGTH = 4000;

// Lasso's dashboard-configured webhook wraps every delivery in an `actions`
// array; verdicts are `ChangeStatus` actions with `type: 'content'`, carrying
// the content id *we* ingested (our content ref) nested at `content.id` (per
// the documented example payload). Other action types (tags, strikes, lists)
// ride the same webhook and are not verdicts — and a `ChangeStatus` on a
// *user* can also embed a related `content` object, which is why the `type`
// guard matters. External input driving DB writes: validate the shape instead
// of casting. `status` stays a plain string — an unrecognized (e.g. newly
// introduced) Lasso status must not 400 the webhook; it just doesn't count as
// blocking.
const lassoWebhookSchema = z.object({
  actions: z.array(
    z.object({
      action_type: z.string().nullish(),
      action_id: z.string().nullish(),
      type: z.string().nullish(),
      // Documented location of the content id…
      content: z.object({ id: z.string().nullish() }).nullish(),
      // …with a flat fallback in case some deliveries flatten it.
      id: z.string().nullish(),
      status: z.string().nullish(),
    }),
  ),
});

interface LassoResult {
  status?: LassoStatus;
  actions?: Array<{ content?: { id?: string } }>;
  content?: { id?: string };
}

const post = async (
  url: string,
  apiToken: string,
  body: Record<string, unknown>,
  fetchOptions?: ModerationFetchOptions,
): Promise<LassoResult> => {
  const response = await moderationFetch(
    url,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    fetchOptions,
  );

  if (!response.ok) {
    throw new Error(`Moderation provider returned ${response.status}`);
  }

  return response.json();
};

// Minimal envelope Lasso's content endpoints require beyond the text itself
// (docs: POST /content — content_id, category, subcategory, and user are
// required). Media is routed by kind into image_urls/video_urls/audio_urls
// (docs: each a flat array of URL strings) so a video isn't moderated as an
// image; `other` kinds (PDFs/docs) have no Lasso field and are dropped (the
// text still covers them). There is no per-request callback — verdicts arrive
// on the webhook configured in the Lasso dashboard.
const envelope = (
  contentId: string,
  content: string,
  media: ModerationMediaItem[] = [],
) => ({
  content_id: contentId,
  text: content.slice(0, LASSO_MAX_TEXT_LENGTH),
  image_urls: media.filter((m) => m.kind === 'image').map((m) => m.url),
  video_urls: media.filter((m) => m.kind === 'video').map((m) => m.url),
  audio_urls: media.filter((m) => m.kind === 'audio').map((m) => m.url),
  category: { id: 'content', name: 'content' },
  subcategory: { id: 'content', name: 'content' },
  user: { id: 'unknown' },
});

const referenceFrom = (
  result: LassoResult,
): Pick<ModerationProviderReference, 'providerRecordId'> => {
  return {
    providerRecordId: result.actions?.[0]?.content?.id ?? result.content?.id,
  };
};

/**
 * Lasso moderation adapter. A platform vendor: it ingests content under an id,
 * returns an allow/flag/hide verdict, and keeps a dashboard record — so it also
 * implements `submitForReview` for the async path. Key/URL never leak in errors.
 */
export const createLassoProvider = ({
  apiToken,
  apiUrl = DEFAULT_API_URL,
  webhookSigningKey,
}: {
  apiToken: string;
  apiUrl?: string;
  /** Webhook secret from the Lasso dashboard; when set, inbound webhooks must
   *  carry a valid `X-Lasso-Signature`. */
  webhookSigningKey?: string;
}): ModerationProvider => ({
  ...(webhookSigningKey
    ? {
        verifyWebhook: (input: ModerationWebhookInput) =>
          verifyLassoWebhook(input, webhookSigningKey),
      }
    : {}),

  scoreText: async ({ content }) => {
    const result = await post(
      `${apiUrl}/content/sync`,
      apiToken,
      envelope(crypto.randomUUID(), content),
      SYNC_GATE_FETCH,
    );
    const blocked = result.status
      ? BLOCKING_STATUSES.includes(result.status)
      : false;
    const scores: ModerationScores = blocked ? { other: BLOCK_SCORE } : {};
    return scores;
  },

  // Lasso takes one combined task (text + media), so it's a single ref —
  // unless there's nothing to review (no text, no media, e.g. a `user`
  // flag), in which case no task is planned and the flag stays pending for
  // manual handling rather than being auto-cleared by an empty submission
  // (matches Hive's behavior).
  planReviewRefs: ({ itemType, itemId, roundId, content, media }) =>
    content.trim() || (media?.length ?? 0) > 0
      ? [encodeContentRef(itemType, itemId, roundId)]
      : [],

  submitForReview: async ({ itemType, itemId, roundId, content, media }) => {
    const ref = encodeContentRef(itemType, itemId, roundId);
    const result = await post(
      `${apiUrl}/content`,
      apiToken,
      envelope(ref, content, media),
    );
    return { ...referenceFrom(result), submittedRefs: [ref] };
  },

  parseWebhook: ({ rawBody }: ModerationWebhookInput): ModerationVerdict[] => {
    const payload = lassoWebhookSchema.parse(JSON.parse(rawBody));
    const verdicts: ModerationVerdict[] = [];
    for (const action of payload.actions) {
      // Lasso batches many action kinds per delivery; we only derive verdicts
      // from content status changes. Log the rest at debug so unexpected
      // payload shapes are visible without alarming on the routine ones.
      if (action.action_type !== 'ChangeStatus' || action.type !== 'content') {
        console.debug(
          `[lasso] skipping non-content-status action: action_type=${action.action_type} type=${action.type}`,
        );
        continue;
      }
      const contentId = action.content?.id ?? action.id;
      if (!contentId) {
        continue;
      }
      // The webhook also carries actions on content we didn't ingest through
      // this integration (e.g. sync-gate checks stored under a bare uuid) —
      // skip rather than 400 the whole delivery; round-matched recording
      // drops anything stale regardless.
      // Unrecognized status → not a verdict; skip it (fail safe) rather than
      // defaulting to clear and un-hiding content on vendor schema drift.
      if (!isRecognizedStatus(action.status)) {
        continue;
      }
      let ref;
      try {
        ref = decodeContentRef(contentId);
      } catch {
        continue;
      }
      const flagged = isBlockingStatus(action.status);
      verdicts.push({
        itemType: ref.itemType,
        itemId: ref.itemId,
        roundId: ref.roundId,
        mediaId: ref.mediaId,
        verdict: flagged ? 'flagged' : 'clear',
        externalRecordId: action.action_id ?? contentId,
        reason: flagged ? `Lasso status: ${action.status}` : undefined,
      });
    }
    return verdicts;
  },
});
