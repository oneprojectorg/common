import { getModerationItemChannels, recordModerationVerdict } from '@op/common';
import { Events, inngest } from '@op/events';
import { realtime } from '@op/realtime/server';
import { randomUUID } from 'node:crypto';

const { moderationVerdictReceived } = Events;

/**
 * Applies a single parsed verdict from the inbox: records it via the flag
 * store + emits the `content/flagged` notification (`recordModerationVerdict`),
 * then publishes the realtime invalidation that lets subscribed clients
 * refetch immediately instead of waiting for a manual reload.
 *
 * `concurrency.key = event.data.concurrencyKey` is the whole point of the
 * move — verdicts for the same item run one at a time, but verdicts for
 * different items run in parallel. The previous handler did the same
 * serialization with a SELECT FOR UPDATE inside the HTTP request, which
 * collided with vendor retry timeouts. The composite key is computed in the
 * dispatch workflow so this field reference is a plain path, not a CEL
 * concatenation.
 */
export const applyModerationVerdictWorkflow = inngest.createFunction(
  {
    id: 'applyModerationVerdict',
    concurrency: { key: 'event.data.concurrencyKey', limit: 1 },
  },
  { event: moderationVerdictReceived.name },
  async ({ event, step }) => {
    const verdict = moderationVerdictReceived.schema.parse(event.data);

    const result = await step.run('record-verdict', () =>
      recordModerationVerdict({
        itemType: verdict.itemType,
        itemId: verdict.itemId,
        roundId: verdict.roundId,
        mediaId: verdict.mediaId,
        verdict: verdict.verdict,
        externalRecordId: verdict.externalRecordId,
        reason: verdict.reason,
        scores: verdict.scores,
      }),
    );

    if (result.action === 'noop') {
      return { action: result.action };
    }

    await step.run('publish-realtime', async () => {
      // Best-effort, exactly like the previous inline path: a thrown channel
      // lookup must not retry the verdict-record step (which is idempotent
      // but emits the `content/flagged` notification on creation/flagged).
      try {
        const channels = await getModerationItemChannels(
          verdict.itemType,
          verdict.itemId,
        );
        const mutationId = randomUUID();
        await Promise.all(
          channels.map((channel) => realtime.publish(channel, { mutationId })),
        );
      } catch (error) {
        console.error(
          '[moderation-webhook] realtime invalidation failed:',
          error,
        );
      }
    });

    return { action: result.action };
  },
);
