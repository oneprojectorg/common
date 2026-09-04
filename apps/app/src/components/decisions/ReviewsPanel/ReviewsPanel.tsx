'use client';

import {
  OVERALL_RECOMMENDATION_KEY,
  type ProposalWithSubmittedReviews,
  type RubricTemplateSchema,
  type SubmittedReviewItem,
  getRubricScoringInfo,
} from '@op/common/client';
import { useMemo } from 'react';

import { ReviewerDetail } from './ReviewerDetail';
import { ReviewerList } from './ReviewerList';

export interface RubricSummary {
  totalPoints: number;
  hasScoring: boolean;
  hasOverallRecommendation: boolean;
}

/** The viewer's own assignment for this proposal, when they hold one. */
export interface OwnReviewEntry {
  /** Matched against each row's reviewer to mark it "(You)". */
  profileId: string;
  hasSubmitted: boolean;
  onOpenForm: () => void;
}

interface ReviewsPanelProps {
  proposalWithReviews: ProposalWithSubmittedReviews;
  rubricTemplate: RubricTemplateSchema | null;
  selectedAssignmentId: string | null;
  onSelectAssignment: (assignmentId: string | null) => void;
  /** When set, that reviewer's review is omitted from the list and detail. */
  excludeProfileId?: string;
  /** Hides the "Review Summary" header + submitted-count line in the list view. */
  hideSummaryHeader?: boolean;
  /** Header text; defaults to "Review Summary". */
  title?: string;
  ownReview?: OwnReviewEntry;
}

export function ReviewsPanel({
  proposalWithReviews,
  rubricTemplate,
  selectedAssignmentId,
  onSelectAssignment,
  excludeProfileId,
  hideSummaryHeader,
  title,
  ownReview,
}: ReviewsPanelProps) {
  const rubricSummary = useMemo<RubricSummary>(() => {
    if (!rubricTemplate) {
      return {
        totalPoints: 0,
        hasScoring: false,
        hasOverallRecommendation: false,
      };
    }
    const info = getRubricScoringInfo(rubricTemplate);
    const hasOverallRecommendation = Boolean(
      rubricTemplate.properties?.[OVERALL_RECOMMENDATION_KEY],
    );
    return {
      totalPoints: info.totalPoints,
      hasScoring: info.criteria.some((c) => c.scored),
      hasOverallRecommendation,
    };
  }, [rubricTemplate]);

  const visibleReviews = useMemo<SubmittedReviewItem[]>(
    () =>
      excludeProfileId
        ? proposalWithReviews.reviews.filter(
            (r) => r.reviewer.id !== excludeProfileId,
          )
        : proposalWithReviews.reviews,
    [proposalWithReviews.reviews, excludeProfileId],
  );

  const selectedReview = selectedAssignmentId
    ? (visibleReviews.find(
        (r) => r.review.assignmentId === selectedAssignmentId,
      ) ?? null)
    : null;

  if (selectedReview && rubricTemplate) {
    return (
      <ReviewerDetail
        item={selectedReview}
        rubricTemplate={rubricTemplate}
        rubricSummary={rubricSummary}
        onBack={() => onSelectAssignment(null)}
      />
    );
  }

  return (
    <ReviewerList
      proposalWithReviews={proposalWithReviews}
      reviews={visibleReviews}
      rubricTemplate={rubricTemplate}
      rubricSummary={rubricSummary}
      onSelectAssignment={onSelectAssignment}
      hideSummaryHeader={hideSummaryHeader}
      title={title}
      ownReview={ownReview}
    />
  );
}
