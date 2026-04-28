'use client';

import {
  OVERALL_RECOMMENDATION_KEY,
  type RubricTemplateSchema,
  type SubmittedReviewItem,
  parseSchemaOptions,
} from '@op/common/client';
import { Header3 } from '@op/ui/Header';
import { useMemo } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProfileAvatar } from '../../ProfileAvatar';
import { SubmittedReviewView } from '../Review/SubmittedReviewView';
import type { ReviewSummaryCapabilities } from './ReviewSummaryPanel';

interface ReviewerDetailProps {
  item: SubmittedReviewItem;
  rubricTemplate: RubricTemplateSchema;
  capabilities: ReviewSummaryCapabilities;
  onBack: () => void;
}

export function ReviewerDetail({
  item,
  rubricTemplate,
  capabilities,
  onBack,
}: ReviewerDetailProps) {
  const t = useTranslations();
  const { hasOverallRecommendation, hasScoring, totalPoints } = capabilities;

  const recommendationLabel = useMemo(() => {
    if (!hasOverallRecommendation || !item.overallRecommendation) {
      return null;
    }
    const options = parseSchemaOptions(
      rubricTemplate.properties?.[OVERALL_RECOMMENDATION_KEY],
    );
    const match = options.find(
      (o) => String(o.value) === item.overallRecommendation,
    );
    return match?.title ?? item.overallRecommendation;
  }, [hasOverallRecommendation, item.overallRecommendation, rubricTemplate]);

  const dotClass = recommendationDotColor(item.overallRecommendation);

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 self-start text-sm text-primary-teal hover:underline"
      >
        <LuArrowLeft className="size-4" />
        {t('Back to all reviewers')}
      </button>

      <div className="flex items-center justify-between border-b border-neutral-gray1 pb-4">
        <div className="flex items-center gap-2">
          <ProfileAvatar
            profile={item.reviewer}
            withLink={false}
            className="size-6"
          />
          <Header3 className="font-serif !text-title-base text-neutral-black">
            {item.reviewer.name ?? item.reviewer.slug}
          </Header3>
        </div>
        {(recommendationLabel || hasScoring) && (
          <div className="flex items-center gap-1">
            {recommendationLabel && (
              <div className="flex items-center gap-1.5">
                <span
                  className={`size-2 rounded-full ${dotClass}`}
                  aria-hidden
                />
                <span className="text-sm text-neutral-black">
                  {recommendationLabel}
                </span>
              </div>
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

function recommendationDotColor(value: string | null): string {
  if (!value) {
    return 'bg-neutral-gray3';
  }
  const normalized = value.toLowerCase();
  if (normalized === 'yes') {
    return 'bg-functional-green';
  }
  if (normalized === 'no') {
    return 'bg-functional-red';
  }
  if (normalized === 'maybe') {
    return 'bg-primary-yellow';
  }
  return 'bg-neutral-gray3';
}
