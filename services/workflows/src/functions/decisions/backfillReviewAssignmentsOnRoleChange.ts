import { backfillReviewAssignments } from '@op/common';
import { db } from '@op/db/client';
import { Events, inngest } from '@op/events';

const { decisionMemberRolesChanged } = Events;

/**
 * Backfills the review assignments a member would have received at the phase
 * transition when they gain roles on a decision mid-phase. The concurrency
 * key serializes rapid edits per decision; the service re-derives eligibility
 * from the DB, so the last run converges.
 */
export const backfillReviewAssignmentsOnRoleChange = inngest.createFunction(
  {
    id: 'backfillReviewAssignmentsOnRoleChange',
    concurrency: { key: 'event.data.decisionProfileId', limit: 1 },
  },
  { event: decisionMemberRolesChanged.name },
  async ({ event, step }) => {
    const { decisionProfileId, authUserId, addedRoleIds } =
      decisionMemberRolesChanged.schema.parse(event.data);

    // Additive-only: a pure removal can never create assignments.
    if (addedRoleIds.length === 0) {
      return { skipped: 'no roles added' };
    }

    const instance = await step.run('resolve-instance', () =>
      db.query.processInstances.findFirst({
        where: { profileId: decisionProfileId },
        columns: { id: true },
      }),
    );

    if (!instance) {
      return { skipped: 'profile is not a decision instance' };
    }

    // Assignments key on the member's personal profile id, not authUserId.
    const member = await step.run('resolve-member-profile', () =>
      db.query.users.findFirst({
        where: { authUserId },
        columns: { profileId: true },
      }),
    );

    const memberProfileId = member?.profileId;
    if (!memberProfileId) {
      return { skipped: 'member has no personal profile' };
    }

    return step.run('backfill-review-assignments', () =>
      backfillReviewAssignments({
        instanceId: instance.id,
        reviewerProfileIds: [memberProfileId],
      }),
    );
  },
);
