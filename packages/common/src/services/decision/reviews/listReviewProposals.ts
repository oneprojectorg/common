import { type SQL, and, count, db, desc, eq, exists, ne } from '@op/db/client';
import { ProposalStatus, proposalCategories, proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { z } from 'zod';

import {
  PAGE_LIMIT,
  ValidationError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../../utils';
import { getInstance } from '../getInstance';
import { listProposals } from '../listProposals';
import { resolveProposalListScope } from '../resolveProposalListScope';
import { assertCanReadPhaseReviews } from '../reviewHelpers';
import {
  type ListReviewProposalsInput,
  type ReviewProposalList,
  reviewProposalListSchema,
} from '../schemas/reviews';

/**
 * The review page's "All proposals" list: the phase's submitted proposals,
 * newest first, filtered by title search and by every given category term.
 *
 * Gated like the tab itself: admins, or reviewers on a phase with open
 * reviews. Rows are the ones `proposal.list` would show the caller — the scope
 * comes from `resolveProposalListScope` — minus drafts, which have nothing to
 * review. The page is picked here and hydrated by `listProposals`, so items
 * keep the `proposal.list` shape.
 */
export async function listReviewProposals({
  user,
  processInstanceId,
  phaseId,
  search,
  categoryIds = [],
  cursor,
  limit = PAGE_LIMIT.md,
}: ListReviewProposalsInput & { user: User }): Promise<ReviewProposalList> {
  const instance = await getInstance({ instanceId: processInstanceId, user });

  await assertCanReadPhaseReviews({
    instance,
    phaseId: phaseId ?? instance.currentStateId ?? undefined,
    user,
  });

  const decodedCursor = decodeReviewProposalCursor(cursor);

  const scope = await resolveProposalListScope({
    input: { processInstanceId, phaseId, search },
    user,
  });

  if (scope.isEmpty) {
    return { items: [], next: null, total: 0 };
  }

  const where = and(
    scope.buildWhereClause(proposals),
    ne(proposals.status, ProposalStatus.DRAFT),
    ...categoryIds.map((categoryId) => hasCategory(categoryId)),
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

  return reviewProposalListSchema.parse({
    items: await hydrateInOrder({
      processInstanceId,
      proposalIds: pageRows.map((row) => row.id),
      user,
    }),
    next:
      hasMore && lastRow?.createdAt
        ? encodeCursor<ReviewProposalCursor>({
            value: lastRow.createdAt,
            id: lastRow.id,
          })
        : null,
    total: totals?.total ?? 0,
  });
}

const reviewProposalCursorSchema = z.object({
  value: z.string(),
  id: z.uuid(),
});

type ReviewProposalCursor = z.infer<typeof reviewProposalCursorSchema>;

function decodeReviewProposalCursor(
  cursor: string | null | undefined,
): ReviewProposalCursor | undefined {
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

  const result = reviewProposalCursorSchema.safeParse(decoded);
  if (!result.success) {
    throw new ValidationError('Invalid cursor');
  }
  return result.data;
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
