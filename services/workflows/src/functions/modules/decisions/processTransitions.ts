import { processDecisionsTransitions } from '@op/common';
import { inngest } from '@op/events';

/**
 * Checks for incomplete decision-making transitions whose scheduled dates have passed
 * and automatically advances processes to their next phase.
 */
export const processTransitions = inngest.createFunction(
  {
    id: 'decisions-process-transitions',
    name: 'Process Decision Making Phases Transitions',
  },
  // Run every hour at minute 0. This supports our tier of Inngest which only supports up to
  // 7 days advance scheduling. In the future we can specifically schedule these.
  { cron: '0 * * * *' },
  async ({ step }) => {
    const result = await step.run('process-phase-transitions', async () => {
      return await processDecisionsTransitions();
    });

    if (result.failed > 0) {
      console.warn('Some transitions failed to process:', {
        processed: result.processed,
        failed: result.failed,
        errors: result.errors,
      });
    }

    return {
      success: true,
      processed: result.processed,
      failed: result.failed,
      errors: result.errors,
    };
  },
);
