import {
  type SQL,
  and,
  count,
  db,
  eq,
  exists,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from '@op/db/client';
import {
  ProposalStatus,
  proposalCategories,
  proposalReviewAssignments,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { z } from 'zod';

import {
  PAGE_LIMIT,
  ValidationError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../utils';
import { listProposals } from './listProposals';
import { resolveProposalListScope } from './resolveProposalListScope';
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

  const requestedPhaseIds: Array<string | undefined> = phaseIds ?? [undefined];
  const listScopes = await Promise.all(
    requestedPhaseIds.map((phaseId) =>
      resolveProposalListScope({
        input: { processInstanceId, phaseId, search },
        user,
      }),
    ),
  );

  const phaseScopes = listScopes.filter((listScope) => !listScope.isEmpty);
  const [firstScope] = listScopes;
  if (phaseScopes.length === 0 || !firstScope) {
    return { items: [], next: null, total: 0 };
  }

  const assignmentPhaseIds =
    phaseIds ??
    (firstScope.instance.currentStateId
      ? [firstScope.instance.currentStateId]
      : []);

  const buildWhere = (
    proposalsTable: typeof proposals,
    cursorCondition?: SQL,
  ): SQL =>
    and(
      or(
        ...phaseScopes.map((listScope) =>
          listScope.buildWhereClause(proposalsTable),
        ),
      ),
      ne(proposalsTable.status, ProposalStatus.DRAFT),
      ...categoryIds.map((categoryId) =>
        hasCategory({ proposalsTable, categoryId }),
      ),
      assignedToProfileId === undefined
        ? undefined
        : isAssignedTo({
            proposalsTable,
            processInstanceId,
            phaseIds: assignmentPhaseIds,
            reviewerProfileId: assignedToProfileId,
          }),
      cursorCondition,
    ) ?? sql`false`;

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
    items: await hydrateInOrder({
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

/** One EXISTS per term, so a proposal must carry all of them. */
function hasCategory({
  proposalsTable,
  categoryId,
}: {
  proposalsTable: typeof proposals;
  categoryId: string;
}): SQL {
  return exists(
    db
      .select({ proposalId: proposalCategories.proposalId })
      .from(proposalCategories)
      .where(
        and(
          eq(proposalCategories.proposalId, proposalsTable.id),
          eq(proposalCategories.taxonomyTermId, categoryId),
        ),
      ),
  );
}

async function hydrateInOrder({
  processInstanceId,
  proposalIds,
  user,
}: {
  processInstanceId: string;
  proposalIds: string[];
  user: User;
}) {
  if (proposalIds.length === 0) {
    return [];
  }

  const { items } = await listProposals({
    input: { processInstanceId, proposalIds, limit: proposalIds.length },
    user,
  });
  const byId = new Map(items.map((item) => [item.id, item]));

  return proposalIds.flatMap((id) => byId.get(id) ?? []);
}
