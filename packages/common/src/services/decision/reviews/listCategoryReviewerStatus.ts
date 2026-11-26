import { and, count, db, eq, ne } from '@op/db/client';
import { ProposalStatus, proposalCategories, proposals } from '@op/db/schema';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../../utils';
import { assertProfileAccess } from '../../assert';
import { getProcessCategories } from '../getProcessCategories';
import { getPhases } from '../instancePhases';
import { decisionPermission } from '../permissions';
import { resolveProposalListScope } from '../resolveProposalListScope';
import { categoryReviewerDataSchema } from '../schemas/categoryReviewerData';
import type {
  CategoryReviewerStatusSchema,
  CategoryWithReviewerStatusSchema,
} from '../schemas/reviews';
import { getPreviousPhases } from '../utils/phaseOrder';
import { countAdvancingByCategory } from './countAdvancingByCategory';

/**
 * Every category of the instance with its category reviewers for the current
 * phase and the develop confirm stamp of each. Category reviewers with no
 * phase do not count. A category with no category reviewer has
 * `reviewers: []`.
 *
 * Readers: an admin of the instance profile, or a holder of Develop Proposals
 * on it. No org fallback.
 */
export async function listCategoryReviewerStatus({
  processInstanceId,
  user,
}: {
  processInstanceId: string;
  user: User;
}): Promise<CategoryWithReviewerStatusSchema[]> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: {
      id: true,
      profileId: true,
      currentStateId: true,
      instanceData: true,
    },
  });

  if (!instance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  if (!instance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: [
      { profile: permission.ADMIN },
      { decisions: permission.ADMIN },
      { decisions: decisionPermission.DEVELOP_PROPOSALS },
    ],
  });

  const currentPhaseId = instance.currentStateId;

  const [categories, categoryReviewers, sourceCounts, advancingCounts] =
    await Promise.all([
      getProcessCategories({ processInstanceId, user }),
      currentPhaseId
        ? db.query.categoryReviewers.findMany({
            where: { processInstanceId, phaseId: currentPhaseId },
            columns: {
              id: true,
              taxonomyTermId: true,
              reviewerProfileId: true,
              data: true,
            },
            with: {
              reviewer: {
                columns: { id: true, name: true, slug: true },
                with: { avatarImage: { columns: { id: true, name: true } } },
              },
            },
            orderBy: { createdAt: 'asc', id: 'asc' },
          })
        : [],
      countSourcesByCategory({ instance, user }),
      countAdvancingByCategory({ processInstanceId }),
    ]);

  const reviewersByTermId = new Map<string, CategoryReviewerStatusSchema[]>();
  for (const categoryReviewer of categoryReviewers) {
    const bucket = reviewersByTermId.get(categoryReviewer.taxonomyTermId) ?? [];
    bucket.push({
      reviewerProfileId: categoryReviewer.reviewerProfileId,
      developConfirmedAt: parseDevelopConfirmedAt({
        categoryReviewerId: categoryReviewer.id,
        data: categoryReviewer.data,
      }),
      profile: {
        id: categoryReviewer.reviewer.id,
        name: categoryReviewer.reviewer.name,
        slug: categoryReviewer.reviewer.slug,
        avatarImage: categoryReviewer.reviewer.avatarImage ?? null,
      },
    });
    reviewersByTermId.set(categoryReviewer.taxonomyTermId, bucket);
  }

  return categories.map((category) => ({
    category,
    reviewers: reviewersByTermId.get(category.id) ?? [],
    sourceCount: sourceCounts.get(category.id) ?? 0,
    advancingCount: advancingCounts.get(category.id) ?? 0,
  }));
}

/** The query of `listPhaseProposals` for the previous phase, grouped by category. */
async function countSourcesByCategory({
  instance,
  user,
}: {
  instance: {
    id: string;
    instanceData: unknown;
    currentStateId: string | null;
  };
  user: User;
}): Promise<Map<string, number>> {
  if (!instance.currentStateId) {
    return new Map();
  }

  const phases = await getPhases({ instance });
  const sourcePhase = getPreviousPhases({ phases }, instance.currentStateId).at(
    -1,
  );
  if (!sourcePhase) {
    return new Map();
  }

  const listScope = await resolveProposalListScope({
    input: { processInstanceId: instance.id, phaseId: sourcePhase.phaseId },
    user,
  });
  if (listScope.isEmpty) {
    return new Map();
  }

  const rows = await db
    .select({
      taxonomyTermId: proposalCategories.taxonomyTermId,
      total: count(),
    })
    .from(proposals)
    .innerJoin(
      proposalCategories,
      eq(proposalCategories.proposalId, proposals.id),
    )
    .where(
      and(
        listScope.buildWhereClause(proposals),
        ne(proposals.status, ProposalStatus.DRAFT),
      ),
    )
    .groupBy(proposalCategories.taxonomyTermId);

  return new Map(rows.map((row) => [row.taxonomyTermId, row.total]));
}

function parseDevelopConfirmedAt({
  categoryReviewerId,
  data,
}: {
  categoryReviewerId: string;
  data: unknown;
}): string | null {
  if (!categoryReviewerDataSchema.validate(data)) {
    logger.warn('Category reviewer data does not match its schema', {
      categoryReviewerId,
    });
    return null;
  }

  return data.developConfirmedAt ?? null;
}
