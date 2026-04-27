import { db } from '@op/db/client';
import { proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { count as countFn, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { UnauthorizedError, decodeCursor, encodeCursor } from '../../utils';
import { getInstance } from './getInstance';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import {
  assembleProposalWithAggregates,
  computeAggregatesInJs,
  getScoredCriterionKeys,
  loadCategoriesByProposalIds,
  proposalsWithReviewsRelations,
} from './proposalsWithReviewAggregates.shared';
import {
  type ProposalsWithReviewAggregatesList,
  proposalsWithReviewAggregatesListSchema,
} from './schemas/reviews';
import type { RubricTemplateSchema } from './types';

export const listProposalsWithReviewAggregatesInputSchema = z.object({
  processInstanceId: z.uuid(),
  /**
   * Phase that scopes the candidate set and the review aggregates.
   * Defaults to the instance's current phase.
   */
  phaseId: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export type ListProposalsWithReviewAggregatesInput = z.infer<
  typeof listProposalsWithReviewAggregatesInputSchema
>;

type AggregatesCursor = {
  /** `createdAt` of the last item on the previous page. */
  createdAt: string;
  /** Tie-breaker for items with identical createdAt. */
  id: string;
};

/**
 * Admin-only paginated list of proposals belonging to a phase, enriched with
 * per-proposal review aggregates. Order is fixed to `createdAt DESC`.
 *
 * Pipeline:
 *   1. Auth + resolve scoped proposal IDs via `getProposalIdsForPhase`.
 *   2. Single relational query (page + full data) and total count, parallel.
 *   3. Categories sidecar for the page IDs, then assemble items.
 */
export async function listProposalsWithReviewAggregates(
  input: ListProposalsWithReviewAggregatesInput & { user: User },
): Promise<ProposalsWithReviewAggregatesList> {
  const { user, processInstanceId, limit } = input;

  const instance = await getInstance({ instanceId: processInstanceId, user });

  if (!instance.access.admin) {
    throw new UnauthorizedError(
      "You don't have admin access to this process instance",
    );
  }

  const rubricTemplate = (instance.instanceData.rubricTemplate ??
    null) as RubricTemplateSchema | null;
  const scoredCriterionKeys = getScoredCriterionKeys(rubricTemplate);

  const phaseId = input.phaseId ?? instance.currentStateId ?? undefined;

  const phaseProposalIds = await getProposalIdsForPhase({
    instanceId: processInstanceId,
    phaseId,
  });

  if (phaseProposalIds.length === 0) {
    return { items: [], total: 0, nextCursor: null };
  }

  // Cursor compares (createdAt, id) lexicographically: prefer rows strictly
  // older than the cursor's createdAt, fall through to the id tiebreak when
  // createdAt is identical.
  const decodedCursor = input.cursor
    ? decodeCursor<AggregatesCursor>(input.cursor)
    : undefined;

  const [pageRowsRaw, totalRows] = await Promise.all([
    db.query.proposals.findMany({
      where: {
        id: { in: phaseProposalIds },
        ...(decodedCursor && {
          OR: [
            { createdAt: { lt: decodedCursor.createdAt } },
            {
              AND: [
                { createdAt: decodedCursor.createdAt },
                { id: { lt: decodedCursor.id } },
              ],
            },
          ],
        }),
      },
      with: proposalsWithReviewsRelations({ processInstanceId, phaseId }),
      orderBy: { createdAt: 'desc', id: 'desc' },
      limit: limit + 1,
    }),
    db
      .select({ count: countFn() })
      .from(proposals)
      .where(inArray(proposals.id, phaseProposalIds)),
  ]);

  const hasMore = pageRowsRaw.length > limit;
  const pageRows = hasMore ? pageRowsRaw.slice(0, limit) : pageRowsRaw;
  const total = Number(totalRows[0]?.count ?? 0);

  if (pageRows.length === 0) {
    return { items: [], total, nextCursor: null };
  }

  const pageIds = pageRows.map((p) => p.id);
  const categoriesByProposalId = await loadCategoriesByProposalIds(pageIds);

  const items = pageRows.map((proposal) => {
    const aggregates = computeAggregatesInJs(
      proposal.reviewAssignments,
      scoredCriterionKeys,
    );
    return assembleProposalWithAggregates({
      proposal,
      aggregates,
      categories: categoriesByProposalId.get(proposal.id) ?? [],
    });
  });

  let nextCursor: string | null = null;
  if (hasMore) {
    const lastRow = pageRows[pageRows.length - 1]!;
    nextCursor = encodeCursor<AggregatesCursor>({
      createdAt: lastRow.createdAt ?? '',
      id: lastRow.id,
    });
  }

  return proposalsWithReviewAggregatesListSchema.parse({
    items,
    total,
    nextCursor,
  });
}
