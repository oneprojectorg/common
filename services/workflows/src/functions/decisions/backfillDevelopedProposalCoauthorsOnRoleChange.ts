import { backfillDevelopedProposalCoauthors } from '@op/common';
import { Channels } from '@op/common/realtime';
import { db } from '@op/db/client';
import { Events, inngest } from '@op/events';
import { realtime } from '@op/realtime/server';

const { decisionMemberRolesChanged } = Events;

/**
 * Makes a member who became an admin of a decision a co-author of its
 * developed proposals while the develop window is open. Add only: a member
 * who stops being an admin keeps their memberships.
 */
export const backfillDevelopedProposalCoauthorsOnRoleChange =
  inngest.createFunction(
    {
      id: 'backfillDevelopedProposalCoauthorsOnRoleChange',
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

      const backfill = await step.run(
        'backfill-developed-proposal-coauthors',
        () =>
          backfillDevelopedProposalCoauthors({
            instanceId: instance.id,
            authUserId,
          }),
      );

      if ('skipped' in backfill || backfill.added === 0) {
        return { backfill };
      }

      // The new co-author can now read these drafts in the develop lists.
      await step.run('publish-decision-proposals', () =>
        realtime.publish(Channels.decisionProposals(instance.id), {
          mutationId: crypto.randomUUID(),
        }),
      );

      return { backfill };
    },
  );
