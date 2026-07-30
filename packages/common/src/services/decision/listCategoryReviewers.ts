import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';

import { getProcessCategories } from './getProcessCategories';
import type { ProcessCategory } from './getProcessCategories';

export interface CategoryReviewerProfile {
  /** The scope row id (stable handle for the removable chip). */
  scopeId: string;
  reviewerProfileId: string;
  phaseId: string | null;
  profile: {
    id: string;
    name: string;
    slug: string;
    avatarImageId: string | null;
  };
}

export interface CategoryWithReviewers {
  category: ProcessCategory;
  reviewers: CategoryReviewerProfile[];
}

/**
 * Lists every category of a process instance with its reviewers. Zero-reviewer
 * categories are kept (LEFT-JOIN semantics) — the admin UI needs them for the
 * "0 reviewers" state. Category identity is the taxonomy term id (via
 * `getProcessCategories`, which also runs the decisions READ check). `phaseId`
 * omitted = instance-wide (phaseId NULL); a value selects that phase's rows.
 */
export async function listCategoryReviewers({
  processInstanceId,
  phaseId,
  user,
}: {
  processInstanceId: string;
  phaseId?: string;
  user: User | undefined;
}): Promise<CategoryWithReviewers[]> {
  const categories = await getProcessCategories({ processInstanceId, user });

  if (categories.length === 0) {
    return [];
  }

  const scopeRows = await db.query.categoryReviewers.findMany({
    where: {
      processInstanceId,
      phaseId: phaseId ?? { isNull: true },
    },
    columns: {
      id: true,
      reviewerProfileId: true,
      taxonomyTermId: true,
      phaseId: true,
    },
    with: {
      reviewer: {
        columns: {
          id: true,
          name: true,
          slug: true,
          avatarImageId: true,
        },
      },
    },
  });

  const reviewersByTermId = new Map<string, CategoryReviewerProfile[]>();
  for (const row of scopeRows) {
    const bucket = reviewersByTermId.get(row.taxonomyTermId) ?? [];
    bucket.push({
      scopeId: row.id,
      reviewerProfileId: row.reviewerProfileId,
      phaseId: row.phaseId,
      profile: {
        id: row.reviewer.id,
        name: row.reviewer.name,
        slug: row.reviewer.slug,
        avatarImageId: row.reviewer.avatarImageId,
      },
    });
    reviewersByTermId.set(row.taxonomyTermId, bucket);
  }

  return categories.map((category) => ({
    category,
    reviewers: reviewersByTermId.get(category.id) ?? [],
  }));
}
