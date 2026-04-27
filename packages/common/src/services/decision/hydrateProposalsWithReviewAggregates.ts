import type { User } from '@op/supabase/lib';
import { z } from 'zod';

import { UnauthorizedError } from '../../utils';
import { getInstance } from './getInstance';
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

export const hydrateProposalsWithReviewAggregatesInputSchema = z.object({
  processInstanceId: z.uuid(),
  /**
   * Phase that scopes which review assignments and reviews count toward
   * aggregates. Defaults to the instance's current phase. Pass an explicit
   * value to look at a previous phase's reviews retrospectively.
   */
  phaseId: z.string().optional(),
  proposalIds: z.array(z.uuid()).min(1).max(200),
});

export type HydrateProposalsWithReviewAggregatesInput = z.infer<
  typeof hydrateProposalsWithReviewAggregatesInputSchema
>;

/**
 * Admin-only hydration: enrich a caller-provided list of proposal IDs with
 * per-proposal review aggregates. No sorting, no pagination, no total
 * count — the caller owns the list. Aggregates are computed in JS over
 * the loaded reviews because the candidate set is bounded and small.
 *
 * Out-of-instance and draft proposals are silently dropped: the
 * relational query filters by id IN (...) and the schema's status check is
 * not applied here because hydration is a trust-the-caller path.
 */
export async function hydrateProposalsWithReviewAggregates(
  input: HydrateProposalsWithReviewAggregatesInput & { user: User },
): Promise<ProposalsWithReviewAggregatesList> {
  const { user, processInstanceId, proposalIds } = input;

  const instance = await getInstance({ instanceId: processInstanceId, user });

  if (!instance.access.admin) {
    throw new UnauthorizedError(
      "You don't have admin access to this process instance",
    );
  }

  if (proposalIds.length === 0) {
    return { items: [], total: 0, nextCursor: null };
  }

  const rubricTemplate = (instance.instanceData.rubricTemplate ??
    null) as RubricTemplateSchema | null;
  const scoredCriterionKeys = getScoredCriterionKeys(rubricTemplate);

  const phaseId = input.phaseId ?? instance.currentStateId ?? undefined;

  const { proposalsById, categoriesByProposalId } =
    await loadProposalDataForAggregation({
      proposalIds,
      processInstanceId,
      phaseId,
    });

  // Drop IDs that didn't match (wrong instance, deleted, etc). The caller
  // owns the order, but we filter to the proposals we actually loaded.
  const items = proposalIds
    .map((id) => proposalsById.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .filter((p) => p.processInstanceId === processInstanceId)
    .map((proposal) => {
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

  return proposalsWithReviewAggregatesListSchema.parse({
    items,
    total: items.length,
    nextCursor: null,
  });
}
