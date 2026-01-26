import { and, asc, db, desc, eq, gt, inArray, or } from '@op/db/client';
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

import {
  NotFoundError,
  type PaginatedResult,
  decodeCursor,
  encodeCursor,
} from '../../utils';
import { getOrgAccessUser } from '../access';
import { listProposals } from './listProposals';

// Uses selectionRank with id as tiebreaker for stable ordering
type SelectionCursor = { selectionRank: number | null; id: string };

type ResultProposalItem = Awaited<
  ReturnType<typeof listProposals>
>['proposals'][number] & {
  selectionRank: number | null;
  voteCount: number;
  allocated: string | null;
};

export const getLatestResultWithProposals = async ({
  processInstanceId,
  user,
  limit = 20,
  cursor,
}: {
  processInstanceId: string;
  user: User;
  limit?: number;
  cursor?: string | null;
}): Promise<PaginatedResult<ResultProposalItem> | null> => {
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
    .where(eq(processInstances.id, processInstanceId))
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

  // Get the latest result (without loading all selections)
  const result = await db._query.decisionProcessResults.findFirst({
    where: eq(decisionProcessResults.processInstanceId, processInstanceId),
    orderBy: [desc(decisionProcessResults.executedAt)],
  });

  if (!result) {
    return null;
  }

  if (!result.success) {
    throw new Error('The latest result execution was not successful');
  }

  // Decode cursor to get the last selectionRank and id from previous page
  const cursorData = cursor ? decodeCursor<SelectionCursor>(cursor) : null;

  // Build cursor condition - fetch items after the cursor position
  // Uses (selectionRank, id) for stable ordering even when ranks are equal
  const cursorCondition = cursorData
    ? cursorData.selectionRank !== null
      ? or(
          gt(
            decisionProcessResultSelections.selectionRank,
            cursorData.selectionRank,
          ),
          and(
            eq(
              decisionProcessResultSelections.selectionRank,
              cursorData.selectionRank,
            ),
            gt(decisionProcessResultSelections.id, cursorData.id),
          ),
        )
      : gt(decisionProcessResultSelections.id, cursorData.id) // If rank is null, just use id
    : undefined;

  // Fetch selections with cursor-based pagination
  const paginatedSelections = await db
    .select({
      id: decisionProcessResultSelections.id,
      proposalId: decisionProcessResultSelections.proposalId,
      selectionRank: decisionProcessResultSelections.selectionRank,
      allocated: decisionProcessResultSelections.allocated,
    })
    .from(decisionProcessResultSelections)
    .where(
      cursorCondition
        ? and(
            eq(decisionProcessResultSelections.processResultId, result.id),
            cursorCondition,
          )
        : eq(decisionProcessResultSelections.processResultId, result.id),
    )
    .orderBy(
      asc(decisionProcessResultSelections.selectionRank),
      asc(decisionProcessResultSelections.id),
    )
    .limit(limit + 1); // Fetch one extra to check hasMore

  if (paginatedSelections.length === 0) {
    return {
      items: [],
      next: null,
      hasMore: false,
    };
  }

  // Check if we have more items
  const hasMore = paginatedSelections.length > limit;
  const selections = hasMore
    ? paginatedSelections.slice(0, limit)
    : paginatedSelections;
  const paginatedProposalIds = selections.map((s) => s.proposalId);

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
          inArray(decisionsVoteProposals.proposalId, paginatedProposalIds),
          eq(decisionsVoteSubmissions.processInstanceId, processInstanceId),
        ),
      )
      .groupBy(decisionsVoteProposals.proposalId),
    listProposals({
      input: {
        processInstanceId,
        authUserId: user.id,
        proposalIds: paginatedProposalIds,
        limit: paginatedProposalIds.length,
      },
      user,
    }),
  ]);

  const voteCountMap = new Map(
    voteCounts.map((vc) => [vc.proposalId, Number(vc.count)]),
  );

  const selectionDataMap = new Map(
    selections.map((s) => [
      s.proposalId,
      {
        selectionRank: s.selectionRank,
        voteCount: voteCountMap.get(s.proposalId) ?? 0,
        allocated: s.allocated,
      },
    ]),
  );

  const proposalMap = new Map(
    enrichedProposals.proposals.map((p) => [p.id, p]),
  );

  // Map proposals to match the DB-ordered selection rank
  // The order is maintained from selections which was sorted by selectionRank at DB level
  const proposalsWithRankAndVotes = selections
    .map((selection) => {
      const proposal = proposalMap.get(selection.proposalId);
      const selectionData = selectionDataMap.get(selection.proposalId);

      // Proposal must exist since we queried for these specific IDs
      if (!proposal) {
        return null;
      }

      return {
        ...proposal,
        selectionRank: selectionData?.selectionRank ?? null,
        voteCount: selectionData?.voteCount ?? 0,
        allocated: selectionData?.allocated ?? null,
      };
    })
    .filter((p) => p !== null);

  // Encode cursor from the last item
  const lastItem = selections[selections.length - 1];
  const nextCursor =
    hasMore && lastItem
      ? encodeCursor<SelectionCursor>({
          selectionRank: lastItem.selectionRank,
          id: lastItem.id,
        })
      : null;

  return {
    items: proposalsWithRankAndVotes,
    next: nextCursor,
    hasMore,
  };
};
