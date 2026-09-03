import { and, asc, db, eq, isNull, or } from '@op/db/client';
import { categoryReviewers, taxonomyTerms } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { assertProfileAccess, assertUserByAuthId } from '../assert';
import { decisionPermission } from './permissions';
import type { ReviewerCategory } from './schemas/reviews';

/**
 * The categories the calling reviewer is scoped to in a phase. Instance-wide
 * rows (`phaseId` NULL) always apply alongside rows scoped to the phase.
 */
export async function listReviewerCategories({
  processInstanceId,
  phaseId,
  user,
}: {
  processInstanceId: string;
  phaseId: string;
  user: User;
}): Promise<ReviewerCategory[]> {
  const [instance, dbUser] = await Promise.all([
    db.query.processInstances.findFirst({
      where: { id: processInstanceId },
      columns: { profileId: true, ownerProfileId: true },
    }),
    assertUserByAuthId(user.id),
  ]);

  if (!instance) {
    throw new NotFoundError('Process instance not found');
  }

  if (!dbUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  const reviewOrAdmin = [
    { decisions: decisionPermission.REVIEW },
    { decisions: permission.ADMIN },
  ];

  // No org fallback: reviewer access comes from a grant on the instance's own
  // profile, which legacy instances may not have — fail closed there.
  if (!instance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }
  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: reviewOrAdmin,
  });

  // Manual join: the relational API can't ORDER BY a joined column. DISTINCT
  // because instance-wide and phase-scoped rows can cover the same term.
  return await db
    .selectDistinct({
      id: taxonomyTerms.id,
      name: taxonomyTerms.label,
    })
    .from(categoryReviewers)
    .innerJoin(
      taxonomyTerms,
      eq(categoryReviewers.taxonomyTermId, taxonomyTerms.id),
    )
    .where(
      and(
        eq(categoryReviewers.processInstanceId, processInstanceId),
        eq(categoryReviewers.reviewerProfileId, dbUser.profileId),
        or(
          isNull(categoryReviewers.phaseId),
          eq(categoryReviewers.phaseId, phaseId),
        ),
      ),
    )
    .orderBy(asc(taxonomyTerms.label), asc(taxonomyTerms.id));
}
