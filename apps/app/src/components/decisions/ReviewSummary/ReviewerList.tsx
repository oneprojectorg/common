'use client';

import {
  OVERALL_RECOMMENDATION_KEY,
  type ProposalWithSubmittedReviews,
  type RubricTemplateSchema,
  type SubmittedReviewItem,
  parseSchemaOptions,
} from '@op/common/client';
import { Button } from '@op/ui/Button';
import { Header3 } from '@op/ui/Header';
import { StatusDot } from '@op/ui/StatusDot';
import { useMemo } from 'react';
import { LuChevronRight } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProfileAvatar } from '../../ProfileAvatar';
import type { RubricSummary } from './ReviewSummaryPanel';
import { recommendationIntent } from './recommendationIntent';

interface ReviewerListProps {
  proposalWithReviews: ProposalWithSubmittedReviews;
  rubricTemplate: RubricTemplateSchema | null;
  rubricSummary: RubricSummary;
  onSelectAssignment: (assignmentId: string) => void;
}

export function ReviewerList({
  proposalWithReviews,
  rubricTemplate,
  rubricSummary,
  onSelectAssignment,
}: ReviewerListProps) {
  const t = useTranslations();
  const { reviewsSubmittedCount, assignmentsCount, averageScore } =
    proposalWithReviews.aggregates;
  const { hasScoring, hasOverallRecommendation, totalPoints } = rubricSummary;

  const recommendationOptions = useMemo(
    () =>
      hasOverallRecommendation && rubricTemplate
        ? parseSchemaOptions(
            rubricTemplate.properties?.[OVERALL_RECOMMENDATION_KEY],
          )
        : [],
    [hasOverallRecommendation, rubricTemplate],
  );

  const groups = useMemo(() => {
    if (!hasOverallRecommendation) {
      return null;
    }
    return getReviewsGroupedByRecommendation(
      proposalWithReviews.reviews,
      recommendationOptions,
    );
  }, [
    proposalWithReviews.reviews,
    hasOverallRecommendation,
    recommendationOptions,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Header3 className="font-serif">{t('Review Summary')}</Header3>
        <p className="text-base text-neutral-charcoal">
          {t(
            '{submitted} out of {total} reviewers submitted a review for this proposal',
            { submitted: reviewsSubmittedCount, total: assignmentsCount },
          )}
        </p>
      </header>

      {hasScoring && (
        <div className="flex items-center justify-between rounded-lg bg-neutral-offWhite p-4">
          <span className="font-serif text-title-sm text-neutral-black">
            {t('Average Score')}
          </span>
          <span className="font-serif text-title-sm text-neutral-black">
            {formatScore(averageScore)}
            <span className="text-neutral-gray4">/{totalPoints}pts</span>
          </span>
        </div>
      )}

      {groups ? (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <RecommendationGroup
              key={group.value}
              label={group.label}
              count={group.items.length}
              value={group.value}
            >
              {group.items.map((item) => (
                <ReviewerRow
                  key={item.review.assignmentId}
                  item={item}
                  showScore={hasScoring}
                  totalPoints={totalPoints}
                  onSelect={onSelectAssignment}
                />
              ))}
            </RecommendationGroup>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Header3 className="font-serif !text-title-sm">
            {t('Submitted Reviews')}
          </Header3>
          <div className="flex flex-col gap-2">
            {proposalWithReviews.reviews.map((item) => (
              <ReviewerRow
                key={item.review.assignmentId}
                item={item}
                showScore={hasScoring}
                totalPoints={totalPoints}
                onSelect={onSelectAssignment}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ReviewerGroup {
  value: string;
  label: string;
  items: SubmittedReviewItem[];
}

function getReviewsGroupedByRecommendation(
  reviews: SubmittedReviewItem[],
  options: ReturnType<typeof parseSchemaOptions>,
): ReviewerGroup[] {
  const order = options.map((o) => String(o.value));
  const titles = new Map(options.map((o) => [String(o.value), o.title]));

  const buckets = new Map<string, SubmittedReviewItem[]>();
  for (const value of order) {
    buckets.set(value, []);
  }

  for (const review of reviews) {
    const value = review.overallRecommendation ?? '';
    if (!value) continue;
    const bucket = buckets.get(value) ?? [];
    bucket.push(review);
    buckets.set(value, bucket);
  }

  return Array.from(buckets.entries())
    .filter(([, items]) => items.length > 0)
    .map(([value, items]) => ({
      value,
      label: titles.get(value) ?? value,
      items,
    }));
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function RecommendationGroup({
  label,
  count,
  value,
  children,
}: {
  label: string;
  count: number;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <StatusDot intent={recommendationIntent(value)} className="gap-2">
        <span className="font-serif !text-title-sm14 text-neutral-black">
          {label} ({count})
        </span>
      </StatusDot>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function ReviewerRow({
  item,
  showScore,
  totalPoints,
  onSelect,
}: {
  item: SubmittedReviewItem;
  showScore: boolean;
  totalPoints: number;
  onSelect: (assignmentId: string) => void;
}) {
  const t = useTranslations();
  return (
    <Button
      unstyled
      onPress={() => onSelect(item.review.assignmentId)}
      className="flex h-14 w-full cursor-pointer items-center justify-between rounded-lg border border-neutral-gray1 bg-white px-3 py-2 text-left outline-0 outline-transparent transition-colors duration-200 hover:bg-neutral-offWhite focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-data-blue"
      aria-label={t('View review by {name}', {
        name: item.reviewer.name ?? item.reviewer.slug,
      })}
    >
      <div className="flex items-center gap-2">
        <ProfileAvatar
          profile={item.reviewer}
          withLink={false}
          className="size-6"
        />
        <div className="flex flex-col">
          <span className="text-base text-neutral-black">
            {item.reviewer.name ?? item.reviewer.slug}
          </span>
          {showScore && (
            <span className="text-sm text-neutral-black">
              {item.score}
              <span className="text-neutral-gray4">/{totalPoints}pts</span>
            </span>
          )}
        </div>
      </div>
      <LuChevronRight className="size-4 text-neutral-gray4" />
    </Button>
  );
}
