import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';

import { assertCategoryReviewerAdmin } from './categoryReviewerHelpers';
import { getEligibleReviewerProfileIds } from './getEligibleReviewerProfileIds';
import type { EligibleReviewerSchema } from './schemas/reviews';

/** Picker row shape, derived from the API encoder so the two can't drift. */
export type EligibleReviewer = EligibleReviewerSchema;

/**
 * Display data (name/slug/avatar/email) for every profile currently holding the
 * REVIEW capability on the decision — the candidate set for the category
 * reviewer picker (PR 7, assign-only). Purpose-built for the combobox: it does
 * NOT reuse the unfiltered Participants list, so only role-holders can be added
 * to a category's scope (scope ≠ capability, Decision 7). Admin-gated. Results
 * are ordered by name in SQL. Category-level exclusion of already-assigned
 * reviewers is done client-side by the card so the same candidate set serves
 * every category.
 */
export async function listEligibleReviewers({
  processInstanceId,
  search,
  user,
}: {
  processInstanceId: string;
  search?: string;
  user: User;
}): Promise<EligibleReviewer[]> {
  const instance = await assertCategoryReviewerAdmin({
    processInstanceId,
    user,
  });

  if (!instance.profileId) {
    return [];
  }

  const eligibleIds = await getEligibleReviewerProfileIds({
    decisionProfileId: instance.profileId,
  });

  if (eligibleIds.length === 0) {
    return [];
  }

  const trimmed = search?.trim();
  const searchPattern =
    trimmed && trimmed.length >= 2 ? `%${trimmed}%` : undefined;

  return db.query.profiles.findMany({
    columns: {
      id: true,
      name: true,
      slug: true,
      avatarImageId: true,
      email: true,
    },
    where: {
      id: { in: eligibleIds },
      ...(searchPattern && { name: { ilike: searchPattern } }),
    },
    orderBy: { name: 'asc' },
  });
}
