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

export interface ReviewSummaryCapabilities {
  totalPoints: number;
  hasScoring: boolean;
  hasOverallRecommendation: boolean;
}

interface ReviewSummaryPanelProps {
  aggregates: ProposalWithSubmittedReviews;
  rubricTemplate: RubricTemplateSchema | null;
  selectedAssignmentId: string | null;
  onSelectAssignment: (assignmentId: string | null) => void;
}

export function ReviewSummaryPanel({
  aggregates,
  rubricTemplate,
  selectedAssignmentId,
  onSelectAssignment,
}: ReviewSummaryPanelProps) {
  const capabilities = useMemo<ReviewSummaryCapabilities>(() => {
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
    ? (aggregates.reviews.find(
        (r) => r.review.assignmentId === selectedAssignmentId,
      ) ?? null)
    : null;

  if (selectedReview && rubricTemplate) {
    return (
      <ReviewerDetail
        item={selectedReview}
        rubricTemplate={rubricTemplate}
        capabilities={capabilities}
        onBack={() => onSelectAssignment(null)}
      />
    );
  }

  return (
    <ReviewerList
      aggregates={aggregates}
      rubricTemplate={rubricTemplate}
      capabilities={capabilities}
      onSelectAssignment={onSelectAssignment}
    />
  );
}
