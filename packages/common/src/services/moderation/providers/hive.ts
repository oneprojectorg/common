import { z } from 'zod';

import { decodeContentRef, encodeContentRef } from '../contentRef';
import type {
  ModerationItemType,
  ModerationMediaItem,
  ModerationProvider,
  ModerationProviderReference,
  ModerationVerdict,
  ModerationWebhookInput,
} from '../types';
import { moderationFetch } from './moderationFetch';

// External input driving DB writes: validate the shape instead of casting.
// Unknown fields are stripped; a payload without our echoed `post_id` (the
// content ref) is rejected and the route answers 400.
const hiveWebhookSchema = z.object({
  post_id: z.string(),
  task_id: z.string().nullish(),
  triggered_rules: z
    .array(z.object({ rule_name: z.string().nullish() }))
    .nullish(),
});

// The async-submit response is external input too — validate the task id
// instead of casting (matches the webhook-parsing pattern above).
const hiveAsyncResponseSchema = z.object({
  task_id: z.string().nullish(),
  id: z.string().nullish(),
});

// The Moderation Dashboard async endpoint: submit content + a callback_url, the
// verdict arrives later via webhook.
const DEFAULT_ASYNC_URL = 'https://api.hivemoderation.com/api/v1/task/async';
// Publisher id Hive requires on every submission; we moderate on behalf of the
// platform rather than per-end-user. Overridable via MODERATION_HIVE_PUBLISHER_ID
// (see provider.ts); this default applies when that env var is unset.
const DEFAULT_PUBLISHER_ID = 'oneproject';

// Hive takes text_data OR url per submission, so text and each media url are
// separate async tasks correlated to the same item via the content ref. Both
// the up-front plan (`planReviewRefs`) and the actual submit derive from this
// single helper so the recorded round always matches what gets submitted.
const planSubmissions = ({
  itemType,
  itemId,
  roundId,
  content,
  media = [],
}: {
  itemType: ModerationItemType;
  itemId: string;
  roundId: string;
  content: string;
  media?: ModerationMediaItem[];
}): Array<{ ref: string; fields: { text_data: string } | { url: string } }> => {
  const tasks: Array<{
    ref: string;
    fields: { text_data: string } | { url: string };
  }> = [];
  if (content.trim()) {
    tasks.push({
      ref: encodeContentRef(itemType, itemId, roundId),
      fields: { text_data: content },
    });
  }
  // Hive's async endpoint detects the media type from the URL itself, so each
  // attachment is submitted as a `url` task regardless of kind.
  for (const [index, item] of media.entries()) {
    tasks.push({
      ref: encodeContentRef(itemType, itemId, roundId, String(index)),
      fields: { url: item.url },
    });
  }
  return tasks;
};

/**
 * Hive moderation adapter for the async review path: submits text and each media
 * url as separate Dashboard tasks and parses the verdict webhooks. Vendor
 * specifics (URL, `token` auth) stay confined here, and the key/URL never appear
 * in thrown errors.
 */
export const createHiveProvider = ({
  apiKey,
  asyncUrl = DEFAULT_ASYNC_URL,
  publisherId = DEFAULT_PUBLISHER_ID,
}: {
  apiKey: string;
  asyncUrl?: string;
  publisherId?: string;
}): ModerationProvider => {
  // One async submission (text or a single media url) → Hive returns a task id.
  const submitAsync = async (
    postId: string,
    fields: { text_data: string } | { url: string },
    callbackUrl: string,
  ): Promise<string | undefined> => {
    const response = await moderationFetch(asyncUrl, {
      method: 'POST',
      headers: {
        authorization: `token ${apiKey}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        user_id: publisherId,
        post_id: postId,
        callback_url: callbackUrl,
        ...fields,
      }),
    });

    if (!response.ok) {
      throw new Error(`Moderation provider returned ${response.status}`);
    }

    const data = hiveAsyncResponseSchema.parse(await response.json());
    return data.task_id ?? data.id ?? undefined;
  };

  return {
    planReviewRefs: (input) => planSubmissions(input).map((task) => task.ref),

    submitForReview: async ({
      callbackUrl,
      ...input
    }): Promise<ModerationProviderReference> => {
      let primaryId: string | undefined;
      const submittedRefs: string[] = [];

      for (const task of planSubmissions(input)) {
        submittedRefs.push(task.ref);
        const recordId = await submitAsync(task.ref, task.fields, callbackUrl);
        primaryId ??= recordId;
      }

      return { providerRecordId: primaryId, submittedRefs };
    },

    // One verdict per callback (one async task per callback).
    parseWebhook: ({
      rawBody,
    }: ModerationWebhookInput): ModerationVerdict[] => {
      const payload = hiveWebhookSchema.parse(JSON.parse(rawBody));
      const { itemType, itemId, roundId, mediaId } = decodeContentRef(
        payload.post_id,
      );
      const rules = payload.triggered_rules ?? [];
      const flagged = rules.length > 0;
      return [
        {
          itemType,
          itemId,
          roundId,
          mediaId,
          verdict: flagged ? 'flagged' : 'clear',
          externalRecordId: payload.task_id ?? undefined,
          reason: flagged
            ? rules
                .map((rule) => rule.rule_name)
                .filter(Boolean)
                .join(', ')
            : undefined,
        },
      ];
    },
  };
};
