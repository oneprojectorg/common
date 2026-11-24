import { relayOutboxEvents } from '@op/common';
import { inngest } from '@op/events';

/**
 * Sweeps unsent event_outbox rows and replays them into Inngest with the
 * row id as the event id (ADR 0023). Delivery is at least once; the
 * consumers dedupe on the outbox id.
 */
export const outboxRelay = inngest.createFunction(
  {
    id: 'outboxRelay',
    name: 'Relay outbox events',
    // One sweep at a time, so rows replay in order and never race.
    concurrency: { limit: 1 },
  },
  { cron: '* * * * *' },
  async ({ step }) => {
    return step.run('relay-outbox-events', async () =>
      relayOutboxEvents({
        send: async (event) => {
          await inngest.send(event);
        },
      }),
    );
  },
);
