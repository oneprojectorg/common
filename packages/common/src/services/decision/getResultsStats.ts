import { db, desc, eq } from '@op/db/client';
import {
  decisionProcessResultSelections,
  decisionProcessResults,
  processInstances,
  proposals,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import { extractBudgetValue } from './proposalDataSchema';

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
  const instance = await db
    .select({
      instanceId: processInstances.id,
      profileId: processInstances.profileId,
      ownerProfileId: processInstances.ownerProfileId,
    })
    .from(processInstances)
    .where(eq(processInstances.id, instanceId))
    .limit(1);

  if (!instance[0]) {
    throw new NotFoundError('Process instance not found');
  }

  if (!instance[0].profileId) {
    throw new NotFoundError('Decision profile not found');
  }

  await assertInstanceProfileAccess({
    user: { id: user.id },
    instance: instance[0],
    profilePermissions: { decisions: permission.READ },
    orgFallbackPermissions: [{ decisions: permission.READ }],
  });

  const result = await db._query.decisionProcessResults.findFirst({
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
      return sum + (Number.isNaN(allocatedNum) ? 0 : allocatedNum);
    }
    const proposalData = item.proposalData as Record<string, unknown>;
    return sum + extractBudgetValue(proposalData?.budget);
  }, 0);

  return {
    membersVoted,
    proposalsFunded,
    totalAllocated,
  };
};
