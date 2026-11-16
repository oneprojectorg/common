import {
  type SQL,
  and,
  count,
  db,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  ne,
  or,
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
  /** The phases to list; omitted means the instance's current phase. */
  phaseIds?: string[];
  /** Only proposals this profile holds a review assignment for, on any of the phases. */
  assignedToProfileId?: string;
  search?: string;
  /** A proposal must carry every term. */
  categoryIds?: string[];
  cursor?: string | null;
  limit?: number;
  user: User;
}

/**
 * The submitted proposals of one or more phases, newest first, filtered by
 * title search, by every given category term and optionally by a reviewer's
 * assignments. Shared by the procedures that list a phase's proposals in
 * their own terms; it runs no gate of its own beyond the decisions READ or
 * ADMIN access `resolveProposalListScope` asserts, so the caller gates first.
 *
 * Each phase's rows are the ones `proposal.list` would show the caller,
 * minus drafts. The phase scopes are ORed in one query over `proposals`, so a
 * proposal in two of the phases is one row and the order, cursor and `total`
 * hold across them. The page is picked here and hydrated by `listProposals`,
 * so items keep the `proposal.list` shape.
 */
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

  // `undefined` lets the scope resolve the current phase exactly as
  // `proposal.list` does.
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

  // The phases an assignment may sit on: the requested ones, or the current one.
  const assignmentPhaseIds =
    phaseIds ??
    (firstScope.instance.currentStateId
      ? [firstScope.instance.currentStateId]
      : []);

  const where = and(
    or(
      ...phaseScopes.map((listScope) => listScope.buildWhereClause(proposals)),
    ),
    ne(proposals.status, ProposalStatus.DRAFT),
    ...categoryIds.map((categoryId) => hasCategory(categoryId)),
    assignedToProfileId === undefined
      ? undefined
      : isAssignedTo({
          processInstanceId,
          phaseIds: assignmentPhaseIds,
          reviewerProfileId: assignedToProfileId,
        }),
  );

  const [rows, [totals]] = await Promise.all([
    db
      .select({ id: proposals.id, createdAt: proposals.createdAt })
      .from(proposals)
      .where(
        and(
          where,
          getCursorCondition({
            column: proposals.createdAt,
            tieBreakerColumn: proposals.id,
            cursor: decodedCursor,
            direction: 'desc',
          }),
        ),
      )
      .orderBy(desc(proposals.createdAt), desc(proposals.id))
      .limit(limit + 1),
    db.select({ total: count() }).from(proposals).where(where),
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
  // Compared against `created_at`; an unparseable value would fail the cast
  // in Postgres as a 500 instead of a 400.
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

  // `decodeCursor` throws a bare 500 on unreadable input; keep every bad
  // cursor a 400.
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

/** A review assignment of the profile on the proposal in any of the phases, any status. */
function isAssignedTo({
  processInstanceId,
  phaseIds,
  reviewerProfileId,
}: {
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
          eq(proposalReviewAssignments.proposalId, proposals.id),
          eq(proposalReviewAssignments.processInstanceId, processInstanceId),
          inArray(proposalReviewAssignments.phaseId, phaseIds),
          eq(proposalReviewAssignments.reviewerProfileId, reviewerProfileId),
          isNull(proposalReviewAssignments.deletedAt),
        ),
      ),
  );
}

/** One EXISTS per term, so a proposal must carry all of them. */
function hasCategory(categoryId: string): SQL {
  return exists(
    db
      .select({ proposalId: proposalCategories.proposalId })
      .from(proposalCategories)
      .where(
        and(
          eq(proposalCategories.proposalId, proposals.id),
          eq(proposalCategories.taxonomyTermId, categoryId),
        ),
      ),
  );
}

/** Hydrates the page through `listProposals` and keeps the order picked here. */
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
