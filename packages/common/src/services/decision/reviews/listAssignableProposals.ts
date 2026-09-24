import { and, db, notInArray } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import {
  UnauthorizedError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../../utils';
import { assertProfileAccess } from '../../assert';
import { parseProposalData } from '../proposalDataSchema';
import { resolveProposalListScope } from '../resolveProposalListScope';
import type { InstancePhaseRef } from '../schemas/instance';
import { getInstancePhases } from '../schemas/instanceData';
import {
  type AssignableProposalList,
  assignableProposalListSchema,
} from '../schemas/reviewAssignments';
import { assertInstancePhase } from '../utils/instance';
import { PIPELINE_INELIGIBLE_STATUSES } from '../votingEligibility';

export interface ListAssignableProposalsInput extends InstancePhaseRef {
  user: User;
  reviewerProfileId: string;
  search?: string;
  cursor?: string | null;
  limit: number;
}

/**
 * One page of the proposals an admin could assign to a reviewer in a phase,
 * with that reviewer's assignment for the phase joined onto each row.
 *
 * Rows must match the pool `assignReviewsToReviewer` accepts, because one
 * out-of-pool id rejects a whole save: list visibility comes from
 * `resolveProposalListScope`, and `PIPELINE_INELIGIBLE_STATUSES` is what the
 * pool adds on top of it.
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
  // The resolver loads the instance and the pool predicates together, so this
  // read never asks for the cached instance payload (every proposal in it).
  const scope = await resolveProposalListScope({
    input: { processInstanceId, phaseId, search },
    user,
  });
  const instance = scope.instance;

  // No org fallback: legacy instances without their own profile fail closed.
  if (!instance.profileId) {
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

  if (scope.isEmpty) {
    return assignableProposalListSchema.parse({ items: [], next: null });
  }

  const decodedCursor = cursor
    ? decodeCursor<{ value: string; id: string }>(cursor)
    : undefined;

  const rows = await db.query.proposals.findMany({
    where: {
      RAW: (table) =>
        and(
          scope.buildWhereClause(table),
          notInArray(table.status, PIPELINE_INELIGIBLE_STATUSES),
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
    // `id` tie-break: rows sharing a `createdAt` page in an undefined order
    // without it, which skips and repeats rows.
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
      // `submittedByProfileId`, matching the self-filter in
      // `insertReviewAssignments` — the write would refuse to create this row.
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
