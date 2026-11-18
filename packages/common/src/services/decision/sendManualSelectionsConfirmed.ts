import { Events, event } from '@op/events';
import { logger } from '@op/logging';

/**
 * Sends `manualSelectionsConfirmed` after the selections of the current phase
 * are confirmed and committed. The send is not awaited; a failure is logged.
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
  event
    .send({
      name: Events.manualSelectionsConfirmed.name,
      data: { processInstanceId, fromPhaseId, toPhaseId },
    })
    .catch((err) => {
      logger.error('Failed to send manual selections confirmed event', {
        processInstanceId,
        error: err,
      });
    });
}
