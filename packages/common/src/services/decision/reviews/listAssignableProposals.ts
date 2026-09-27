import { and, db, inArray } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import {
  UnauthorizedError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../../utils';
import { assertProfileAccess } from '../../assert';
import { getProposalIdsForPhase } from '../getProposalsForPhase';
import { parseProposalData } from '../proposalDataSchema';
import { buildProposalTitleSearchCondition } from '../proposalTitleSearch';
import type { InstancePhaseRef } from '../schemas/instance';
import { getInstancePhases } from '../schemas/instanceData';
import {
  type AssignableProposalList,
  assignableProposalListSchema,
} from '../schemas/reviewAssignments';
import { assertInstancePhase } from '../utils/instance';

export interface ListAssignableProposalsInput extends InstancePhaseRef {
  user: User;
  reviewerProfileId: string;
  search?: string;
  cursor?: string | null;
  limit: number;
}

/**
 * Reads the same pool `assignReviewsToReviewer` validates against, so the list
 * and the save cannot diverge: one out-of-pool id rejects the whole save.
 */
export async function listAssignableProposals({
  user,
  processInstanceId,
  phaseId,
  reviewerProfileId,
  search,
  cursor,
  limit,
}: ListAssignableProposalsInput): Promise<AssignableProposalList> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: {
      id: true,
      profileId: true,
      instanceData: true,
      currentStateId: true,
    },
  });

  if (!instance?.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }
  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  assertInstancePhase({
    instance: {
      instanceData: { phases: getInstancePhases(instance.instanceData) },
    },
    phaseId,
  });

  const poolIds = await getProposalIdsForPhase({ instance, phaseId });
  if (poolIds.length === 0) {
    return assignableProposalListSchema.parse({ items: [], next: null });
  }

  const decodedCursor = cursor
    ? decodeCursor<{ value: string; id: string }>(cursor)
    : undefined;

  const rows = await db.query.proposals.findMany({
    where: {
      RAW: (table) =>
        and(
          inArray(table.id, poolIds),
          buildProposalTitleSearchCondition(table, search),
          getCursorCondition({
            column: table.createdAt,
            tieBreakerColumn: table.id,
            cursor: decodedCursor,
            direction: 'desc',
          }),
        )!,
    },
    columns: {
      id: true,
      profileId: true,
      proposalData: true,
      submittedByProfileId: true,
      createdAt: true,
    },
    with: {
      profile: { columns: { name: true } },
      submittedBy: { columns: { name: true } },
      reviewAssignments: {
        where: { processInstanceId, phaseId, reviewerProfileId },
        columns: { id: true, status: true },
        with: { reviews: { columns: { state: true }, limit: 1 } },
      },
    },
    // The `id` tie-break is required, or rows sharing a `createdAt` are skipped or repeated.
    orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
    limit: limit + 1,
  });

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const items = pageRows.map((row) => {
    const assignment = row.reviewAssignments[0] ?? null;

    return {
      id: row.id,
      profileId: row.profileId,
      proposalData: parseProposalData(row.proposalData),
      profileName: row.profile?.name ?? null,
      authorName: row.submittedBy?.name ?? null,
      assignment: assignment
        ? {
            id: assignment.id,
            status: assignment.status,
            reviewState: assignment.reviews[0]?.state ?? null,
          }
        : null,
      isOwn: row.submittedByProfileId === reviewerProfileId,
    };
  });

  const lastRow = pageRows[pageRows.length - 1];

  return assignableProposalListSchema.parse({
    items,
    next:
      hasMore && lastRow?.createdAt != null
        ? encodeCursor<{ value: string; id: string }>({
            value: lastRow.createdAt,
            id: lastRow.id,
          })
        : null,
  });
}
