'use client';

import {
  OVERALL_RECOMMENDATION_KEY,
  type RubricTemplateSchema,
  type SubmittedReviewItem,
  findSchemaOption,
} from '@op/common/client';
import { Header3 } from '@op/sense/Header';
import { StatusDot } from '@op/sense/StatusDot';

import { ProfileAvatar } from '../../ProfileAvatar';
import { SubmittedReviewView } from '../Review/SubmittedReviewView';
import { BackToReviewers } from './BackToReviewers';
import type { RubricSummary } from './ReviewsPanel';
import { recommendationIntent } from './recommendationIntent';

interface ReviewerDetailProps {
  item: SubmittedReviewItem;
  rubricTemplate: RubricTemplateSchema;
  rubricSummary: RubricSummary;
  onBack: () => void;
}

export function ReviewerDetail({
  item,
  rubricTemplate,
  rubricSummary,
  onBack,
}: ReviewerDetailProps) {
  const { hasOverallRecommendation, hasScoring, totalPoints } = rubricSummary;

  const recommendationLabel = (() => {
    if (!hasOverallRecommendation || !item.overallRecommendation) {
      return null;
    }
    const match = findSchemaOption(
      rubricTemplate.properties?.[OVERALL_RECOMMENDATION_KEY],
      item.overallRecommendation,
    );
    return match?.title ?? item.overallRecommendation;
  })();

  return (
    <div className="flex flex-col gap-6">
      <BackToReviewers onClick={onBack} />

      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <ProfileAvatar
            profile={item.reviewer}
            withLink={false}
            className="size-6"
          />
          <Header3>{item.reviewer.name ?? item.reviewer.slug}</Header3>
        </div>
        {(recommendationLabel || hasScoring) && (
          <div className="flex items-center gap-1">
            {recommendationLabel && (
              <StatusDot
                intent={recommendationIntent(item.overallRecommendation)}
              >
                <span className="text-sm">{recommendationLabel}</span>
              </StatusDot>
            )}
            {hasScoring && (
              <span className="text-sm text-muted-foreground">
                ({item.score}/{totalPoints})
              </span>
            )}
          </div>
        )}
      </div>

      <SubmittedReviewView
        rubricTemplate={rubricTemplate}
        review={item.review}
      />
    </div>
  );
}
