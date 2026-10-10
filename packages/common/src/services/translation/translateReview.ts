import { db } from '@op/db/client';
import { ProposalReviewState } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import type { TranslatableEntry } from '@op/translation';
import { permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { assertProfileAccess, assertUserByAuthId } from '../assert';
import { getInstance } from '../decision/getInstance';
import { decisionPermission } from '../decision/permissions';
import { canReadPhaseReviews } from '../decision/reviewHelpers';
import { rubricReviewDataSchema } from '../decision/schemas/reviews';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';

export type ReviewTranslation = {
  /** Translated rationale per rubric criterion key. */
  rationales: Record<string, string>;
  overallComment?: string;
};

/**
 * Translates the reviewer-written text of one submitted review: the
 * per-criterion `rationales` and the `overallComment`. Rubric prompts are
 * process configuration and are not translated; answers, scores and the
 * recommendation are never sent.
 *
 * Readable by the same callers the submitted-review views serve: anyone
 * `canReadPhaseReviews` admits for the review's phase (admins; reviewers when
 * the phase has open reviews — `getProposalWithReviewAggregates`), and the
 * review's own reviewer (`getReviewAssignment`). The response carries no
 * reviewer identity.
 */
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

  // Moderation-detached proposals 404 for everyone, as on every review read.
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

/**
 * Admits anyone `canReadPhaseReviews` admits for the review's phase, and the
 * review's own reviewer while they keep the standing
 * `assertReviewAssignmentContext` requires.
 */
const assertCanReadReview = async ({
  instance,
  assignment,
  reviewerProfileId,
  user,
}: {
  instance: Awaited<ReturnType<typeof getInstance>>;
  assignment: { phaseId: string; reviewerProfileId: string };
  reviewerProfileId: string | null;
  user: User;
}) => {
  if (
    await canReadPhaseReviews({ instance, phaseId: assignment.phaseId, user })
  ) {
    return;
  }

  const isOwnReview =
    reviewerProfileId != null &&
    assignment.reviewerProfileId === reviewerProfileId;

  if (!isOwnReview || !instance.profileId) {
    throw new UnauthorizedError("You don't have access to this review");
  }

  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: [
      { decisions: decisionPermission.REVIEW },
      { decisions: permission.ADMIN },
    ],
  });
};

/** One entry per non-blank rationale, plus the overall comment. */
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
