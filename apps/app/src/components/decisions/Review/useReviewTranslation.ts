'use client';

import { trpc } from '@op/api/client';
import type { ProposalReview } from '@op/common/client';
import { useMemo } from 'react';

import { useTranslateLink } from '../useTranslateLink';

/**
 * A submitted review's own "See translation": the reviewer's notes and the
 * feedback to the author, translated through `translateReview`. The rubric's
 * questions, scores and recommendation are process configuration and stay as
 * authored.
 */
export const useReviewTranslation = (review: ProposalReview) => {
  const { rationales } = review.reviewData;
  const detectionText = useMemo(
    () =>
      [...Object.values(rationales), review.overallComment ?? '']
        .filter(Boolean)
        .join('\n'),
    [rationales, review.overallComment],
  );

  const translateReview = trpc.translation.translateReview.useMutation();

  return useTranslateLink({
    detectionText,
    enabled: true,
    request: (targetLocale) =>
      translateReview
        .mutateAsync({ reviewId: review.id, targetLocale })
        .then(({ rationales: translatedRationales, overallComment }) =>
          Object.keys(translatedRationales).length > 0 || overallComment
            ? { rationales: translatedRationales, overallComment }
            : undefined,
        ),
  });
};
