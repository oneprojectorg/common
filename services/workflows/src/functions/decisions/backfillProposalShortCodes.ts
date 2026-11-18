import {
  backfillInstanceShortCodes,
  listInstancesNeedingShortCodes,
} from '@op/common';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

const { decisionShortCodeBackfillRequested } = Events;

export const backfillProposalShortCodes = inngest.createFunction(
  {
    id: 'backfillProposalShortCodes',
    concurrency: { limit: 1 },
  },
  { event: decisionShortCodeBackfillRequested.name },
  async ({ event, step }) => {
    const { instanceIds } = decisionShortCodeBackfillRequested.schema.parse(
      event.data ?? {},
    );

    const pending = await step.run('list-instances', () =>
      listInstancesNeedingShortCodes(),
    );

    const targets = instanceIds
      ? pending.filter(({ instanceId }) => instanceIds.includes(instanceId))
      : pending;

    const results: Array<{ instanceId: string; assigned: number }> = [];
    for (const { instanceId } of targets) {
      const result = await step.run(`backfill-${instanceId}`, () =>
        backfillInstanceShortCodes({ instanceId }),
      );
      results.push({ instanceId, assigned: result.assigned });
    }

    const assigned = results.reduce(
      (total, entry) => total + entry.assigned,
      0,
    );

    logger.info('Proposal short-code backfill completed', {
      instances: results.length,
      assigned,
    });

    return { instances: results.length, assigned, results };
  },
);
