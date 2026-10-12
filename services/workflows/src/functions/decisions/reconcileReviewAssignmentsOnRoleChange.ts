import {
  backfillReviewAssignments,
  pruneReviewAssignmentsForMember,
} from '@op/common';
import { db } from '@op/db/client';
import { Events, inngest } from '@op/events';

const { decisionMemberRolesChanged } = Events;

/**
 * Reconciles a member's review assignments in the current phase when their
 * roles on a decision change, including removal from the decision. Both
 * services re-derive eligibility from the DB, and the concurrency key
 * serializes edits per decision, so the last run converges.
 */
export const reconcileReviewAssignmentsOnRoleChange = inngest.createFunction(
  {
    id: 'reconcileReviewAssignmentsOnRoleChange',
    concurrency: { key: 'event.data.decisionProfileId', limit: 1 },
  },
  { event: decisionMemberRolesChanged.name },
  async ({ event, step }) => {
    const { decisionProfileId, authUserId } =
      decisionMemberRolesChanged.schema.parse(event.data);

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

    const prune = await step.run('prune-review-assignments', () =>
      pruneReviewAssignmentsForMember({
        instanceId: instance.id,
        reviewerProfileId: memberProfileId,
      }),
    );

    const backfill = await step.run('backfill-review-assignments', () =>
      backfillReviewAssignments({
        instanceId: instance.id,
        reviewerProfileIds: [memberProfileId],
      }),
    );

    return { prune, backfill };
  },
);
