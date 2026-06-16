import { z } from 'zod';

import { decodeContentRef, encodeContentRef } from '../contentRef';
import type {
  ModerationCategory,
  ModerationItemType,
  ModerationMediaItem,
  ModerationProvider,
  ModerationProviderReference,
  ModerationScores,
  ModerationVerdict,
  ModerationWebhookInput,
} from '../types';
import { mergeModerationScores } from '../utils';
import { SYNC_GATE_FETCH, moderationFetch } from './moderationFetch';

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

const DEFAULT_URL = 'https://api.thehive.ai/api/v2/task/sync';
// The Moderation Dashboard async endpoint (distinct host from the classifier):
// submit content + a callback_url, the verdict arrives later via webhook.
const DEFAULT_ASYNC_URL = 'https://api.hivemoderation.com/api/v1/task/async';
// Publisher id Hive requires on every submission; we moderate on behalf of the
// platform rather than per-end-user. Overridable via MODERATION_HIVE_PUBLISHER_ID
// (see provider.ts); this default applies when that env var is unset.
const DEFAULT_PUBLISHER_ID = 'oneproject';
// Hive returns integer severity 0-3 per class; normalize onto our 0-1 scale.
const HIVE_MAX_SCORE = 3;
// Hive's sync text endpoint caps submissions at 1024 chars and asks callers to
// split longer text across submissions, so we chunk and score each piece.
const HIVE_MAX_TEXT_LENGTH = 1024;

// Hive's full set of text-moderation classes mapped onto our categories. Every
// class Hive can return is mapped so nothing disallowed is silently dropped:
// `spam`/`promotions` have no direct category, so they fall under `other`.
const CLASS_MAP: Record<string, ModerationCategory> = {
  sexual: 'sexual',
  hate: 'hate',
  violence: 'violence',
  bullying: 'harassment',
  spam: 'other',
  promotions: 'other',
};

interface HiveClass {
  class?: string;
  score?: unknown;
}

const normalizeHiveScores = (data: unknown): ModerationScores => {
  const output = (
    data as { response?: { output?: Array<{ classes?: HiveClass[] }> } }
  )?.response?.output;
  const classes = Array.isArray(output) ? output[0]?.classes : undefined;
  if (!Array.isArray(classes)) {
    return {};
  }

  const scores: ModerationScores = {};
  for (const entry of classes) {
    const category = entry.class ? CLASS_MAP[entry.class] : undefined;
    const raw = entry.score;
    if (!category || typeof raw !== 'number' || !Number.isFinite(raw)) {
      continue;
    }
    const normalized = raw / HIVE_MAX_SCORE;
    // Keep the strongest signal if multiple Hive classes map to one category.
    scores[category] = Math.max(scores[category] ?? 0, normalized);
  }
  return scores;
};

// Split text into <=maxLength pieces, preferring to break on whitespace so we
// don't slice through a word (which could mask a flagged term).
const chunkText = (text: string, maxLength: number): string[] => {
  if (text.length <= maxLength) {
    return [text];
  }
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxLength, text.length);
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(' ', end);
      if (lastSpace > start) {
        end = lastSpace;
      }
    }
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
};

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
 * Hive text-moderation adapter. A pure classifier: it scores text but keeps no
 * per-item record, so it exposes no `submitForReview`. Vendor specifics (URL,
 * `Token` auth, 0-3 score scale, 1024-char limit) stay confined here, and the
 * key/URL never appear in thrown errors.
 */
export const createHiveProvider = ({
  apiKey,
  apiUrl = DEFAULT_URL,
  asyncUrl = DEFAULT_ASYNC_URL,
  publisherId = DEFAULT_PUBLISHER_ID,
}: {
  apiKey: string;
  apiUrl?: string;
  asyncUrl?: string;
  publisherId?: string;
}): ModerationProvider => {
  const scoreChunk = async (chunk: string): Promise<ModerationScores> => {
    const response = await moderationFetch(
      apiUrl,
      {
        method: 'POST',
        headers: {
          authorization: `Token ${apiKey}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ text_data: chunk }),
      },
      SYNC_GATE_FETCH,
    );

    if (!response.ok) {
      throw new Error(`Moderation provider returned ${response.status}`);
    }

    return normalizeHiveScores(await response.json());
  };

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
    scoreText: async ({ content }) => {
      const chunks = chunkText(content, HIVE_MAX_TEXT_LENGTH);
      const perChunk = await Promise.all(chunks.map(scoreChunk));
      return mergeModerationScores(...perChunk);
    },

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
