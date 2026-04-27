import { and, db, desc, inArray, or, sql } from '@op/db/client';
import { proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { count as countFn } from 'drizzle-orm';
import { z } from 'zod';

import { UnauthorizedError, decodeCursor, encodeCursor } from '../../utils';
import { getInstance } from './getInstance';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import {
  assembleProposalWithAggregates,
  computeAggregatesInJs,
  getScoredCriterionKeys,
  loadProposalDataForAggregation,
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
 * per-proposal review aggregates. Order is fixed to `createdAt DESC`;
 * aggregates are computed in JS over the loaded reviews.
 *
 * Pipeline:
 *   1. Auth + resolve scoped proposal IDs via `getProposalIdsForPhase`.
 *   2. Page query (id + createdAt, with optional cursor) + total count,
 *      run in parallel.
 *   3. Load full data + categories for the page IDs, then assemble items.
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

  const baseConditions = [inArray(proposals.id, phaseProposalIds)];

  let cursorCondition: ReturnType<typeof and> | undefined;
  if (input.cursor) {
    const decoded = decodeCursor<AggregatesCursor>(input.cursor);
    cursorCondition = or(
      sql`${proposals.createdAt} < ${decoded.createdAt}`,
      and(
        sql`${proposals.createdAt} = ${decoded.createdAt}`,
        sql`${proposals.id} < ${decoded.id}`,
      ),
    );
  }

  const pageConditions = cursorCondition
    ? [...baseConditions, cursorCondition]
    : baseConditions;

  const [pageRowsRaw, totalRows] = await Promise.all([
    db
      .select({ id: proposals.id, createdAt: proposals.createdAt })
      .from(proposals)
      .where(and(...pageConditions))
      .orderBy(desc(proposals.createdAt), desc(proposals.id))
      .limit(limit + 1),
    db
      .select({ count: countFn() })
      .from(proposals)
      .where(and(...baseConditions)),
  ]);

  const hasMore = pageRowsRaw.length > limit;
  const pageRows = hasMore ? pageRowsRaw.slice(0, limit) : pageRowsRaw;
  const total = Number(totalRows[0]?.count ?? 0);

  if (pageRows.length === 0) {
    return { items: [], total, nextCursor: null };
  }

  const pageIds = pageRows.map((r) => r.id);

  const { proposalsById, categoriesByProposalId } =
    await loadProposalDataForAggregation({
      proposalIds: pageIds,
      processInstanceId,
      phaseId,
    });

  // Preserve the SQL sort order — `findMany({ where: in })` doesn't guarantee any.
  const items = pageIds.map((id) => {
    const proposal = proposalsById.get(id);
    if (!proposal) {
      throw new Error(`Page row missing full data: ${id}`);
    }
    const aggregates = computeAggregatesInJs(
      proposal.reviewAssignments,
      scoredCriterionKeys,
    );
    return assembleProposalWithAggregates({
      proposal,
      aggregates,
      categories: categoriesByProposalId.get(id) ?? [],
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
