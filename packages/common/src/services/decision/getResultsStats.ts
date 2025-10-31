import { db, desc, eq } from '@op/db/client';
import {
  decisionProcessResultSelections,
  decisionProcessResults,
  organizations,
  processInstances,
  proposals,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { getOrgAccessUser } from '../access';

export const getResultsStats = async ({
  instanceId,
  user,
}: {
  instanceId: string;
  user: User;
}): Promise<{
  membersVoted: number;
  proposalsFunded: number;
  totalAllocated: number;
} | null> => {
  const instanceWithOrg = await db
    .select({
      instanceId: processInstances.id,
      organizationId: organizations.id,
    })
    .from(processInstances)
    .innerJoin(
      organizations,
      eq(organizations.profileId, processInstances.ownerProfileId),
    )
    .where(eq(processInstances.id, instanceId))
    .limit(1);

  if (!instanceWithOrg[0]) {
    throw new NotFoundError('Process instance not found');
  }

  const { organizationId } = instanceWithOrg[0];

  const orgUser = await getOrgAccessUser({
    user,
    organizationId,
  });

  assertAccess({ decisions: permission.READ }, orgUser?.roles ?? []);

  const result = await db.query.decisionProcessResults.findFirst({
    where: eq(decisionProcessResults.processInstanceId, instanceId),
    orderBy: [desc(decisionProcessResults.executedAt)],
  });

  if (!result) {
    return null;
  }

  const membersVoted = result.voterCount;

  if (!result.success) {
    throw new Error('The latest result execution was not successful');
  }

  const selectedProposalsWithData = await db
    .select({
      proposalId: decisionProcessResultSelections.proposalId,
      proposalData: proposals.proposalData,
      allocated: decisionProcessResultSelections.allocated,
    })
    .from(decisionProcessResultSelections)
    .innerJoin(
      proposals,
      eq(decisionProcessResultSelections.proposalId, proposals.id),
    )
    .where(eq(decisionProcessResultSelections.processResultId, result.id));

  const proposalsFunded = selectedProposalsWithData.length;

  // If no proposals were selected, return zeros for funded stats
  if (proposalsFunded === 0) {
    return {
      membersVoted,
      proposalsFunded: 0,
      totalAllocated: 0,
    };
  }

  // Sum up the allocated amounts (or fall back to budgets from proposalData)
  const totalAllocated = selectedProposalsWithData.reduce((sum, item) => {
    // Use allocated amount if it exists, otherwise fall back to budget
    if (item.allocated !== null) {
      const allocatedNum = Number(item.allocated);
      return sum + (isNaN(allocatedNum) ? 0 : allocatedNum);
    }
    const proposalData = item.proposalData as any;
    const budget = proposalData?.budget ?? 0;
    return sum + (typeof budget === 'number' ? budget : 0);
  }, 0);

  return {
    membersVoted,
    proposalsFunded,
    totalAllocated,
  };
};
