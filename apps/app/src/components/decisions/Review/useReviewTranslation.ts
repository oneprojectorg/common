'use client';

import { trpc } from '@op/api/client';
import type { ProposalReview } from '@op/common/client';
import { useMemo } from 'react';

import { useTranslateLink } from '../useTranslateLink';

/** Translates the reviewer's notes and feedback; rubric text is config and stays as is. */
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
