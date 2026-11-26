import { Events, event } from '@op/events';
import { logger } from '@op/logging';
import { waitUntil } from '@vercel/functions';

type CategoryAssignmentEventName =
  | typeof Events.categoryDevelopmentConfirmed.name
  | typeof Events.categoryDevelopmentUnconfirmed.name;

/**
 * Sends one event per category assignment that a confirm or unconfirm
 * changed, after the update. Never throws; a failure is logged.
 */
export function sendCategoryAssignmentEvents({
  name,
  processInstanceId,
  phaseId,
  assignments,
}: {
  name: CategoryAssignmentEventName;
  processInstanceId: string;
  phaseId: string;
  assignments: ReadonlyArray<{
    taxonomyTermId: string;
    reviewerProfileId: string;
  }>;
}): void {
  try {
    waitUntil(
      event
        .send(
          assignments.map(({ taxonomyTermId, reviewerProfileId }) => ({
            name,
            data: {
              processInstanceId,
              phaseId,
              taxonomyTermId,
              reviewerProfileId,
            },
          })),
        )
        .catch((error) => {
          logger.error('Failed to send category assignment events', {
            name,
            processInstanceId,
            error,
          });
        }),
    );
  } catch (error) {
    // waitUntil can throw synchronously off-Vercel (no request context).
    logger.error('Failed to schedule category assignment events', {
      name,
      processInstanceId,
      error,
    });
  }
}
