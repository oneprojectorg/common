import { drainEventOutbox } from '@op/common';
import { inngest } from '@op/events';

/**
 * Drains the transactional event outbox once a minute.
 *
 * The drainer is idempotent and uses FOR UPDATE SKIP LOCKED, so overlapping
 * ticks (or a tick that runs longer than a minute under brownout) coexist
 * safely. We swallow per-row Inngest failures inside `drainEventOutbox` —
 * they stay in the outbox and retry on the next tick — but we re-throw if
 * the batch itself blows up so Inngest's own retry/visibility kicks in.
 */
export const drainOutbox = inngest.createFunction(
  {
    id: 'events-drain-outbox',
    name: 'Drain transactional event outbox',
  },
  { cron: '* * * * *' },
  async ({ step }) => {
    const result = await step.run('drain', () => drainEventOutbox());

    if (result.failed > 0) {
      console.warn('Some outbox events failed to publish', result);
    }

    return result;
  },
);
