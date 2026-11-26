import { db } from '@op/db/client';
import { ProposalRelationshipType } from '@op/db/schema';

import { invalidateProfileUserAccessCache } from '../access';
import { assertGlobalRole } from '../assert';
import { getDecisionAdmins } from './getDecisionAdmins';
import { insertProposalCoauthors } from './insertProposalCoauthors';
import { getPhases } from './instancePhases';
import { isDevelopWindowOpen } from './isDevelopWindowOpen';
import { lockProcessInstanceOrThrow } from './lockProcessInstance';

type BackfillDevelopedProposalCoauthorsResult =
  | { skipped: string }
  | { added: number };

/**
 * Add-only backfill for a member who became an admin of the decision while
 * its develop window is open: makes them a co-author of each developed
 * proposal they are not a member of yet, with the role the author holds.
 * Never removes a membership.
 *
 * `profileUsers` has no unique key on (profile, user), so the run holds the
 * instance lock, which `createDevelopedProposal` also takes, and reads the
 * missing memberships inside it: a repeated, retried or concurrent run sees
 * the rows a previous one committed.
 */
export async function backfillDevelopedProposalCoauthors({
  instanceId,
  authUserId,
}: {
  instanceId: string;
  authUserId: string;
}): Promise<BackfillDevelopedProposalCoauthorsResult> {
  const result = await db.transaction(
    async (
      tx,
    ): Promise<{ skipped: string } | { proposalProfileIds: string[] }> => {
      await lockProcessInstanceOrThrow({ db: tx, instanceId });
      const instance = await tx.query.processInstances.findFirst({
        where: { id: instanceId },
        columns: {
          id: true,
          profileId: true,
          currentStateId: true,
          instanceData: true,
        },
      });

      if (!instance?.profileId) {
        return { skipped: 'instance has no decision profile' };
      }

      const phases = await getPhases({ instance, db: tx });
      const isWindowOpen = await isDevelopWindowOpen({
        instance: { ...instance, phases },
        dbClient: tx,
      });

      if (!isWindowOpen) {
        return { skipped: 'develop window is not open' };
      }

      const admins = await getDecisionAdmins({
        decisionProfileId: instance.profileId,
        dbClient: tx,
      });
      const admin = admins.find((holder) => holder.authUserId === authUserId);

      if (!admin) {
        return { skipped: 'member is not an admin of the decision' };
      }

      const developedEdges = await tx.query.proposalRelationships.findMany({
        where: {
          processInstanceId: instanceId,
          relationshipType: ProposalRelationshipType.DEVELOPED,
          deletedAt: { isNull: true },
          targetProposal: {
            deletedAt: { isNull: true },
            NOT: { profile: { profileUsers: { authUserId } } },
          },
        },
        columns: {},
        with: { targetProposal: { columns: { profileId: true } } },
      });
      // An entry developed from several sources has one edge per source.
      const proposalProfileIds = [
        ...new Set(developedEdges.map((edge) => edge.targetProposal.profileId)),
      ];

      const adminRole = await assertGlobalRole('Admin', tx);
      await insertProposalCoauthors({
        tx,
        coauthors: proposalProfileIds.map((profileId) => ({
          profileId,
          authUserId,
          email: admin.email,
        })),
        roleId: adminRole.id,
      });

      return { proposalProfileIds };
    },
  );

  if ('skipped' in result) {
    return result;
  }

  await Promise.all(
    result.proposalProfileIds.map((profileId) =>
      invalidateProfileUserAccessCache({ authUserId, profileId }),
    ),
  );

  return { added: result.proposalProfileIds.length };
}
