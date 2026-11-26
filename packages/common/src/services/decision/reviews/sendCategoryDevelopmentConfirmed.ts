import { Events, event } from '@op/events';
import { logger } from '@op/logging';
import { waitUntil } from '@vercel/functions';

/**
 * Sends one `categoryDevelopmentConfirmed` per category after a confirm
 * stamped rows of those categories. Never throws; a failure is logged.
 */
export function sendCategoryDevelopmentConfirmed({
  processInstanceId,
  phaseId,
  taxonomyTermIds,
}: {
  processInstanceId: string;
  phaseId: string;
  taxonomyTermIds: ReadonlyArray<string>;
}): void {
  try {
    waitUntil(
      event
        .send(
          taxonomyTermIds.map((taxonomyTermId) => ({
            name: Events.categoryDevelopmentConfirmed.name,
            data: { processInstanceId, phaseId, taxonomyTermId },
          })),
        )
        .catch((error) => {
          logger.error('Failed to send category development confirmed event', {
            processInstanceId,
            error,
          });
        }),
    );
  } catch (error) {
    // waitUntil can throw synchronously off-Vercel (no request context).
    logger.error('Failed to schedule category development confirmed event', {
      processInstanceId,
      error,
    });
  }
}
