import { and, asc, db, gt } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { UnauthorizedError } from '../../../utils';
import { assertProfileAccess } from '../../assert';
import { getInstance } from '../getInstance';
import { REVIEW_REMINDER_MAX_RECIPIENTS } from '../reviewReminderTemplate';
import {
  type ReviewReminderRecipients,
  type ReviewReminderRecipientsParams,
  reviewReminderRecipientsSchema,
} from '../schemas/reviewAssignments';
import { assertInstancePhase } from '../utils/instance';
import {
  buildPhaseReviewerRollup,
  getPhaseReviewerFilters,
  toEligibleReviewer,
} from './phaseReviewerRollup';

export async function listReviewReminderRecipients({
  user,
  processInstanceId,
  phaseId,
  search,
  status,
}: ReviewReminderRecipientsParams & {
  user: User;
}): Promise<ReviewReminderRecipients> {
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

  const rollup = buildPhaseReviewerRollup({ processInstanceId, phaseId });

  const rows = await db
    .select({
      id: rollup.id,
      name: rollup.name,
      slug: rollup.slug,
      avatarImageId: rollup.avatarImageId,
      email: rollup.email,
      remainingCount: rollup.remainingCount,
    })
    .from(rollup)
    .where(
      and(
        gt(rollup.remainingCount, 0),
        getPhaseReviewerFilters({ rollup, search, status }),
      ),
    )
    .orderBy(asc(rollup.name), asc(rollup.id))
    // No total: revisit when a process has more reviewers than the cap.
    .limit(REVIEW_REMINDER_MAX_RECIPIENTS);

  return reviewReminderRecipientsSchema.parse({
    items: rows.map((row) => ({
      reviewer: toEligibleReviewer(row),
      remainingCount: row.remainingCount,
    })),
  });
}
