import { Events, event } from '@op/events';
import { logger } from '@op/logging';
import { waitUntil } from '@vercel/functions';
import type { z } from 'zod';

type DecisionMemberRolesChangedData = z.infer<
  typeof Events.decisionMemberRolesChanged.schema
>;

/**
 * Fire-and-forget emission of the decision/member-roles-changed event.
 * Never throws — a committed role change must not surface as a failure
 * to the caller because event scheduling failed.
 */
export const emitDecisionMemberRolesChanged = (
  eventData: DecisionMemberRolesChangedData,
): void => {
  try {
    waitUntil(
      event
        .send({
          name: Events.decisionMemberRolesChanged.name,
          data: eventData,
        })
        .catch((error) => {
          // Log the full payload so a dropped event can be replayed by hand.
          logger.error('Failed to send decision member roles changed event', {
            eventData,
            error,
          });
        }),
    );
  } catch (error) {
    // waitUntil can throw synchronously off-Vercel (no request context).
    logger.error('Failed to schedule decision member roles changed event', {
      eventData,
      error,
    });
  }
};
