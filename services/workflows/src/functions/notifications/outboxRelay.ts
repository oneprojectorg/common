import { relayOutboxEvents } from '@op/common';
import { inngest } from '@op/events';

export const outboxRelay = inngest.createFunction(
  {
    id: 'outboxRelay',
    name: 'Relay outbox events',
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
