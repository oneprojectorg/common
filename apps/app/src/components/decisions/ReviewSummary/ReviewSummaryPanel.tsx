'use client';

import {
  OVERALL_RECOMMENDATION_KEY,
  type ProposalWithSubmittedReviews,
  type RubricTemplateSchema,
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

interface ReviewSummaryPanelProps {
  proposalWithReviews: ProposalWithSubmittedReviews;
  rubricTemplate: RubricTemplateSchema | null;
  selectedAssignmentId: string | null;
  onSelectAssignment: (assignmentId: string | null) => void;
}

export function ReviewSummaryPanel({
  proposalWithReviews,
  rubricTemplate,
  selectedAssignmentId,
  onSelectAssignment,
}: ReviewSummaryPanelProps) {
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

  const selectedReview = selectedAssignmentId
    ? (proposalWithReviews.reviews.find(
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
      rubricTemplate={rubricTemplate}
      rubricSummary={rubricSummary}
      onSelectAssignment={onSelectAssignment}
    />
  );
}
