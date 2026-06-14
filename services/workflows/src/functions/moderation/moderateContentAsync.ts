import {
  getModerationCallbackUrl,
  getModerationProvider,
  recordSubmissionRound,
  resolveModerationItemText,
  resolveModerationMedia,
  reviewContentAsync,
  submissionMediaIdsFromRefs,
} from '@op/common';
import { Events, inngest } from '@op/events';

const { contentSubmitted } = Events;

/**
 * Async moderation pass. Runs after content is written (the synchronous gate
 * already blocked the obvious text cases on write). Resolves the item's
 * current text and attachments — the event carries only the item ref, so
 * collab-doc proposals get their TipTap fragment text rather than an empty
 * proposalData snapshot — and submits both to the configured provider; the
 * verdict arrives later on the provider webhook, which is where a flag is
 * created. No-op when no provider or webhook secret is configured.
 */
export const moderateContentAsync = inngest.createFunction(
  { id: 'moderateContentAsync' },
  { event: contentSubmitted.name },
  async ({ event, step }) => {
    const { itemType, itemId } = contentSubmitted.schema.parse(event.data);

    const callbackUrl = getModerationCallbackUrl();
    if (!callbackUrl) {
      return { submitted: false, reason: 'moderation-webhook-not-configured' };
    }

    // Memoized per event: a retry of `submit-for-review` reuses the same
    // round id, so a verdict that already landed for a task submitted on the
    // first attempt still matches its row instead of being orphaned.
    const roundId = await step.run('round-id', () => crypto.randomUUID());

    const content = await step.run('resolve-content', () =>
      resolveModerationItemText(itemType, itemId),
    );

    const media = await step.run('resolve-media', () =>
      resolveModerationMedia(itemType, itemId),
    );

    return step.run('submit-for-review', () =>
      reviewContentAsync(
        { itemType, itemId, roundId, content, media, callbackUrl },
        {
          provider: getModerationProvider(),
          recordRound: (type, id, round, refs) =>
            recordSubmissionRound(
              type,
              id,
              round,
              submissionMediaIdsFromRefs(refs),
            ),
        },
      ),
    );
  },
);
