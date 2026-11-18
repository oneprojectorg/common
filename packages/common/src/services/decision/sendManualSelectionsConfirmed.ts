import { Events, event } from '@op/events';
import { logger } from '@op/logging';
import { waitUntil } from '@vercel/functions';

/**
 * Sends `manualSelectionsConfirmed` after the selections of the current phase
 * are confirmed and committed. Never throws; a failure is logged.
 */
export function sendManualSelectionsConfirmed({
  processInstanceId,
  fromPhaseId,
  toPhaseId,
}: {
  processInstanceId: string;
  fromPhaseId: string;
  toPhaseId: string;
}): void {
  try {
    waitUntil(
      event
        .send({
          name: Events.manualSelectionsConfirmed.name,
          data: { processInstanceId, fromPhaseId, toPhaseId },
        })
        .catch((error) => {
          logger.error('Failed to send manual selections confirmed event', {
            processInstanceId,
            error,
          });
        }),
    );
  } catch (error) {
    // waitUntil can throw synchronously off-Vercel (no request context).
    logger.error('Failed to schedule manual selections confirmed event', {
      processInstanceId,
      error,
    });
  }
}
