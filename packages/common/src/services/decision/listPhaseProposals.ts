import {
  type SQL,
  and,
  count,
  db,
  eq,
  exists,
  inArray,
  isNull,
} from '@op/db/client';
import { proposalReviewAssignments, proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { z } from 'zod';

import {
  PAGE_LIMIT,
  ValidationError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../utils';
import {
  buildProposalFilterConditions,
  hydrateProposalsInOrder,
  resolvePhaseProposalQuery,
} from './phaseProposalQuery';
import {
  type PhaseProposalList,
  phaseProposalListSchema,
} from './schemas/proposal';

export interface ListPhaseProposalsInput {
  processInstanceId: string;
  /** Omitted means the current phase. */
  phaseIds?: string[];
  assignedToProfileId?: string;
  search?: string;
  categoryIds?: string[];
  cursor?: string | null;
  limit?: number;
  user: User;
}

/** Non-draft proposals of the phases, newest first. Checks only READ, so callers gate first. */
export async function listPhaseProposals({
  processInstanceId,
  phaseIds,
  assignedToProfileId,
  search,
  categoryIds = [],
  cursor,
  limit = PAGE_LIMIT.md,
  user,
}: ListPhaseProposalsInput): Promise<PhaseProposalList> {
  const decodedCursor = decodePhaseProposalCursor(cursor);

  const query = await resolvePhaseProposalQuery({
    processInstanceId,
    phaseIds,
    user,
  });
  if (query.isEmpty) {
    return { items: [], next: null, total: 0 };
  }

  const buildWhere = (
    proposalsTable: typeof proposals,
    cursorCondition?: SQL,
  ): SQL =>
    query.buildWhere(proposalsTable, [
      ...buildProposalFilterConditions({ proposalsTable, search, categoryIds }),
      assignedToProfileId === undefined
        ? undefined
        : isAssignedTo({
            proposalsTable,
            processInstanceId,
            phaseIds: query.phaseIds,
            reviewerProfileId: assignedToProfileId,
          }),
      cursorCondition,
    ]);

  const [rows, [totals]] = await Promise.all([
    db.query.proposals.findMany({
      columns: { id: true, createdAt: true },
      where: {
        RAW: (table) =>
          buildWhere(
            table,
            getCursorCondition({
              column: table.createdAt,
              tieBreakerColumn: table.id,
              cursor: decodedCursor,
              direction: 'desc',
            }),
          ),
      },
      orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
      limit: limit + 1,
    }),
    // The relational API has no aggregate, so the total stays a select.
    db.select({ total: count() }).from(proposals).where(buildWhere(proposals)),
  ]);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];

  return phaseProposalListSchema.parse({
    items: await hydrateProposalsInOrder({
      processInstanceId,
      proposalIds: pageRows.map((row) => row.id),
      user,
    }),
    next:
      hasMore && lastRow?.createdAt
        ? encodeCursor<PhaseProposalCursor>({
            value: lastRow.createdAt,
            id: lastRow.id,
          })
        : null,
    total: totals?.total ?? 0,
  });
}

const phaseProposalCursorSchema = z.object({
  // A non-date value would fail in Postgres as a 500.
  value: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  id: z.uuid(),
});

type PhaseProposalCursor = z.infer<typeof phaseProposalCursorSchema>;

function decodePhaseProposalCursor(
  cursor: string | null | undefined,
): PhaseProposalCursor | undefined {
  if (!cursor) {
    return undefined;
  }

  const decoded = ((): unknown => {
    try {
      return decodeCursor<unknown>(cursor);
    } catch {
      return undefined;
    }
  })();

  const result = phaseProposalCursorSchema.safeParse(decoded);
  if (!result.success) {
    throw new ValidationError('Invalid cursor');
  }
  return result.data;
}

function isAssignedTo({
  proposalsTable,
  processInstanceId,
  phaseIds,
  reviewerProfileId,
}: {
  proposalsTable: typeof proposals;
  processInstanceId: string;
  phaseIds: string[];
  reviewerProfileId: string;
}): SQL {
  return exists(
    db
      .select({ id: proposalReviewAssignments.id })
      .from(proposalReviewAssignments)
      .where(
        and(
          eq(proposalReviewAssignments.proposalId, proposalsTable.id),
          eq(proposalReviewAssignments.processInstanceId, processInstanceId),
          inArray(proposalReviewAssignments.phaseId, phaseIds),
          eq(proposalReviewAssignments.reviewerProfileId, reviewerProfileId),
          isNull(proposalReviewAssignments.deletedAt),
        ),
      ),
  );
}
