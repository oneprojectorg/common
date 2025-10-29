import { and, db, desc, eq, inArray } from '@op/db/client';
import {
  decisionProcessResultSelections,
  decisionProcessResults,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
  organizations,
  processInstances,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';
import { count as countFn } from 'drizzle-orm';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { getOrgAccessUser } from '../access';
import { listProposals } from './listProposals';

export const getLatestResultWithProposals = async ({
  processInstanceId,
  user,
}: {
  processInstanceId: string;
  user: User;
}) => {
  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  const instance = await db.query.processInstances.findFirst({
    where: eq(processInstances.id, processInstanceId),
  });

  if (!instance) {
    throw new NotFoundError('Process instance not found');
  }

  const instanceOrg = await db
    .select({
      id: organizations.id,
    })
    .from(organizations)
    .where(eq(organizations.profileId, instance.ownerProfileId))
    .limit(1);

  if (!instanceOrg[0]) {
    throw new NotFoundError('Organization not found');
  }

  const orgUser = await getOrgAccessUser({
    user,
    organizationId: instanceOrg[0].id,
  });

  assertAccess({ decisions: permission.READ }, orgUser?.roles ?? []);

  const result = await db.query.decisionProcessResults.findFirst({
    where: eq(decisionProcessResults.processInstanceId, processInstanceId),
    orderBy: [desc(decisionProcessResults.executedAt)],
    with: {
      selections: {
        with: {
          proposal: true,
        },
        orderBy: [decisionProcessResultSelections.selectionRank],
      },
    },
  });

  if (!result) {
    return null;
  }

  if (!result.success) {
    throw new Error('The latest result execution was not successful');
  }

  const proposalIds = result.selections.map((s) => s.proposalId);

  if (proposalIds.length === 0) {
    return {
      proposals: [],
    };
  }

  const [voteCounts, enrichedProposals] = await Promise.all([
    db
      .select({
        proposalId: decisionsVoteProposals.proposalId,
        count: countFn(),
      })
      .from(decisionsVoteProposals)
      .innerJoin(
        decisionsVoteSubmissions,
        eq(
          decisionsVoteProposals.voteSubmissionId,
          decisionsVoteSubmissions.id,
        ),
      )
      .where(
        and(
          inArray(decisionsVoteProposals.proposalId, proposalIds),
          eq(decisionsVoteSubmissions.processInstanceId, processInstanceId),
        ),
      )
      .groupBy(decisionsVoteProposals.proposalId),
    listProposals({
      input: {
        processInstanceId,
        authUserId: user.id,
        proposalIds,
        limit: proposalIds.length,
      },
      user,
    }),
  ]);

  const voteCountMap = new Map(
    voteCounts.map((vc) => [vc.proposalId, Number(vc.count)]),
  );

  const selectionDataMap = new Map(
    result.selections.map((s) => [
      s.proposalId,
      {
        selectionRank: s.selectionRank,
        voteCount: voteCountMap.get(s.proposalId) ?? 0,
      },
    ]),
  );

  const proposalsWithRankAndVotes = enrichedProposals.proposals
    .map((proposal) => {
      const selectionData = selectionDataMap.get(proposal.id);
      return {
        ...proposal,
        selectionRank: selectionData?.selectionRank ?? null,
        voteCount: selectionData?.voteCount ?? 0,
      };
    })
    .sort((a, b) => {
      const rankA = a.selectionRank ?? Number.MAX_SAFE_INTEGER;
      const rankB = b.selectionRank ?? Number.MAX_SAFE_INTEGER;
      return rankA - rankB;
    });

  return {
    proposals: proposalsWithRankAndVotes,
  };
};
