'use client';

import {
  OVERALL_RECOMMENDATION_KEY,
  type RubricTemplateSchema,
  type SubmittedReviewItem,
  findSchemaOption,
} from '@op/common/client';
import { Button } from '@op/ui/Button';
import { Header3 } from '@op/ui/Header';
import { StatusDot } from '@op/ui/StatusDot';
import { LuArrowLeft } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProfileAvatar } from '../../ProfileAvatar';
import { SubmittedReviewView } from '../Review/SubmittedReviewView';
import type { RubricSummary } from './ReviewSummaryPanel';
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
  const t = useTranslations();
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
      <Button
        variant="link"
        size="inline"
        onPress={onBack}
        className="inline-flex items-center gap-1 self-start text-base"
      >
        <LuArrowLeft className="size-4" />
        {t('Back to all reviewers')}
      </Button>

      <div className="flex items-center justify-between border-b border-neutral-gray1 pb-4">
        <div className="flex items-center gap-2">
          <ProfileAvatar
            profile={item.reviewer}
            withLink={false}
            className="size-6"
          />
          <Header3 className="font-serif">
            {item.reviewer.name ?? item.reviewer.slug}
          </Header3>
        </div>
        {(recommendationLabel || hasScoring) && (
          <div className="flex items-center gap-1">
            {recommendationLabel && (
              <StatusDot
                intent={recommendationIntent(item.overallRecommendation)}
              >
                <span className="text-sm text-neutral-black">
                  {recommendationLabel}
                </span>
              </StatusDot>
            )}
            {hasScoring && (
              <span className="text-sm text-neutral-gray4">
                ({item.score}/{totalPoints}pts)
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
