import { db } from '@op/db/client';
import { ProposalReviewState } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import type { TranslatableEntry } from '@op/translation';

import { NotFoundError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { getInstance } from '../decision/getInstance';
import { assertCanReadReview } from '../decision/reviewHelpers';
import { rubricReviewDataSchema } from '../decision/schemas/reviews';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';

export type ReviewTranslation = {
  rationales: Record<string, string>;
  overallComment?: string;
};

/** Translates a submitted review's notes and feedback for anyone who can read the review. */
export async function translateReview({
  reviewId,
  targetLocale,
  user,
}: {
  reviewId: string;
  targetLocale: SupportedLocale;
  user: User;
}): Promise<
  ReviewTranslation & {
    sourceLocale: string;
    targetLocale: SupportedLocale;
  }
> {
  const [review, commonUser] = await Promise.all([
    db.query.proposalReviews.findFirst({
      where: { id: reviewId, state: ProposalReviewState.SUBMITTED },
      columns: { id: true, reviewData: true, overallComment: true },
      with: {
        assignment: {
          columns: {
            processInstanceId: true,
            phaseId: true,
            reviewerProfileId: true,
          },
          with: {
            proposal: { columns: { moderationDetachedAt: true } },
          },
        },
      },
    }),
    assertUserByAuthId(user.id),
  ]);

  if (!review || review.assignment.proposal.moderationDetachedAt) {
    throw new NotFoundError('Review', reviewId);
  }

  const { assignment } = review;
  const instance = await getInstance({
    instanceId: assignment.processInstanceId,
    user,
  });
  await assertCanReadReview({
    instance,
    assignment,
    reviewerProfileId: commonUser.profileId,
    user,
  });

  const prefix = `review:${review.id}:`;
  const entries = buildReviewEntries({
    prefix,
    reviewData: review.reviewData,
    overallComment: review.overallComment,
  });

  if (entries.length === 0) {
    return { rationales: {}, sourceLocale: '', targetLocale };
  }

  const results = await runTranslateBatch(entries, targetLocale);

  return { ...readReviewTranslation({ prefix, results }), targetLocale };
}

const buildReviewEntries = ({
  prefix,
  reviewData,
  overallComment,
}: {
  prefix: string;
  reviewData: unknown;
  overallComment: string | null;
}): TranslatableEntry[] => {
  const { rationales } = rubricReviewDataSchema.parse(reviewData);
  const entries: TranslatableEntry[] = Object.entries(rationales)
    .filter(([, rationale]) => rationale.trim())
    .map(([criterionKey, rationale]) => ({
      contentKey: `${prefix}rationale:${criterionKey}`,
      text: rationale,
    }));

  if (overallComment?.trim()) {
    entries.push({
      contentKey: `${prefix}overall_comment`,
      text: overallComment,
    });
  }

  return entries;
};

const readReviewTranslation = ({
  prefix,
  results,
}: {
  prefix: string;
  results: Awaited<ReturnType<typeof runTranslateBatch>>;
}): ReviewTranslation & { sourceLocale: string } => {
  const rationales: Record<string, string> = {};
  let overallComment: string | undefined;

  for (const result of results) {
    const key = result.contentKey.slice(prefix.length);
    if (key === 'overall_comment') {
      overallComment = result.translatedText;
    } else if (key.startsWith('rationale:')) {
      rationales[key.slice('rationale:'.length)] = result.translatedText;
    }
  }

  const sourceLocale =
    results.find((result) => result.sourceLocale)?.sourceLocale ?? '';

  return { rationales, overallComment, sourceLocale };
};
