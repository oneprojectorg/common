import { Events, event } from '@op/events';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';
import { randomUUID } from 'node:crypto';

import { UnauthorizedError, ValidationError } from '../../../utils';
import { assertProfileAccess } from '../../assert';
import { getInstance } from '../getInstance';
import type {
  SendReviewReminderInput,
  SendReviewReminderResult,
} from '../schemas/reviewAssignments';
import { assertInstancePhase, isInstanceCurrentPhase } from '../utils/instance';

/**
 * Enqueues one reminder email per chosen reviewer. The workflow sends only to
 * ids with open assignments in this instance and phase.
 */
export async function sendReviewReminder({
  user,
  processInstanceId,
  phaseId,
  reviewerProfileIds,
  message,
}: SendReviewReminderInput & {
  user: User;
}): Promise<SendReviewReminderResult> {
  const instance = await getInstance({ instanceId: processInstanceId, user });

  if (!instance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }
  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  assertInstancePhase({ instance, phaseId });
  if (!isInstanceCurrentPhase(instance, phaseId)) {
    throw new ValidationError(
      'A reminder can only be sent for the current phase',
    );
  }

  const uniqueReviewerProfileIds = [...new Set(reviewerProfileIds)];
  const batchId = randomUUID();

  await event.send({
    name: Events.reviewReminderRequested.name,
    data: {
      batchId,
      processInstanceId,
      phaseId,
      reviewerProfileIds: uniqueReviewerProfileIds,
      message,
    },
  });

  return { batchId };
}
