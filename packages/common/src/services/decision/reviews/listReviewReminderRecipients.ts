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
} from './phaseReviewerRollup';

/**
 * The reviewers of the Reviewers tab, under the same search and status, who
 * still have an open assignment in the phase. Unpaginated, capped.
 */
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
      openCount: rollup.openCount,
    })
    .from(rollup)
    .where(
      and(
        gt(rollup.openCount, 0),
        getPhaseReviewerFilters({ rollup, search, status }),
      ),
    )
    .orderBy(asc(rollup.name), asc(rollup.id))
    .limit(REVIEW_REMINDER_MAX_RECIPIENTS);

  return reviewReminderRecipientsSchema.parse({
    items: rows.map((row) => ({
      reviewer: {
        id: row.id,
        name: row.name,
        slug: row.slug,
        avatarImageId: row.avatarImageId,
        email: row.email,
      },
      remainingCount: row.openCount,
      lastRemindedAt: null,
    })),
  });
}
