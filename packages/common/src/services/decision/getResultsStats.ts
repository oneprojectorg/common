import { cache } from '@op/cache';
import { and, db, desc, eq } from '@op/db/client';
import {
  decisionProcessResultSelections,
  decisionProcessResults,
  processInstances,
  proposals,
} from '@op/db/schema';
import { permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { type AccessUser, assertInstanceProfileAccess } from '../access';
import { extractBudgetValue } from './proposalDataSchema';

type ResultsStats = {
  membersVoted: number;
  proposalsFunded: number;
  totalAllocated: number;
};

export const getResultsStats = async ({
  instanceId,
  user,
}: {
  instanceId: string;
  user?: AccessUser;
}): Promise<ResultsStats | null> => {
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
    throw new NotFoundError('Process instance', instanceId);
  }

  if (!instance[0].profileId) {
    throw new NotFoundError('Decision profile', instanceId);
  }

  await assertInstanceProfileAccess({
    user,
    instance: instance[0],
    profilePermissions: { decisions: permission.READ },
    orgFallbackPermissions: [{ decisions: permission.READ }],
  });

  // The cache key is the instance id alone, so the access assert must run
  // before the cache is read.
  return cache({
    type: 'decision',
    params: [instanceId, 'stats'],
    fetch: () => computeResultsStats(instanceId),
  });
};

const computeResultsStats = async (
  instanceId: string,
): Promise<ResultsStats | null> => {
  // Failed and reverted runs stay as audit records; they are not the current
  // results, so they resolve to "no results" rather than an error.
  const result = await db._query.decisionProcessResults.findFirst({
    where: and(
      eq(decisionProcessResults.processInstanceId, instanceId),
      eq(decisionProcessResults.success, true),
    ),
    orderBy: [desc(decisionProcessResults.executedAt)],
  });

  if (!result) {
    return null;
  }

  const membersVoted = result.voterCount;

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
