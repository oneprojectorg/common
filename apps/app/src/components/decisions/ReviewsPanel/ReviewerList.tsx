'use client';

import {
  OVERALL_RECOMMENDATION_KEY,
  type ProposalWithSubmittedReviews,
  type RubricTemplateSchema,
  type SubmittedReviewItem,
  parseSchemaOptions,
} from '@op/common/client';
import { Button } from '@op/sense/Button';
import { Header3 } from '@op/sense/Header';
import { StatusDot } from '@op/sense/StatusDot';
import { useMemo } from 'react';
import { LuChevronRight } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProfileAvatar } from '../../ProfileAvatar';
import {
  type RecommendationLabels,
  useRecommendationLabels,
} from '../useRecommendationLabels';
import { AverageScoreBar } from './AverageScoreBar';
import type { OwnReviewEntry, RubricSummary } from './ReviewsPanel';
import { recommendationIntent } from './recommendationIntent';

interface ReviewerListProps {
  proposalWithReviews: ProposalWithSubmittedReviews;
  reviews: SubmittedReviewItem[];
  rubricTemplate: RubricTemplateSchema | null;
  rubricSummary: RubricSummary;
  onSelectAssignment: (assignmentId: string) => void;
  hideSummaryHeader?: boolean;
  title?: string;
  ownReview?: OwnReviewEntry;
}

export function ReviewerList({
  proposalWithReviews,
  reviews,
  rubricTemplate,
  rubricSummary,
  onSelectAssignment,
  hideSummaryHeader,
  title,
  ownReview,
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

  // The group headings are our copy, not the admin's, so they come from the
  // dictionary; a value we don't recognize falls back to what the schema holds.
  const recommendation = useRecommendationLabels();
  const groups = useMemo(() => {
    if (!hasOverallRecommendation) {
      return null;
    }
    return getReviewsGroupedByRecommendation(
      reviews,
      recommendationOptions,
      recommendation.label,
    );
  }, [
    reviews,
    hasOverallRecommendation,
    recommendationOptions,
    recommendation,
  ]);

  return (
    <div className="flex flex-col gap-6">
      {!hideSummaryHeader && (
        <header className="flex flex-col gap-2">
          <Header3>{title ?? t('Review Summary')}</Header3>
          <p className="text-base">
            {t(
              '{submitted} out of {total} reviewers submitted a review for this proposal',
              { submitted: reviewsSubmittedCount, total: assignmentsCount },
            )}
          </p>
        </header>
      )}

      {hasScoring && reviewsSubmittedCount > 0 && (
        <AverageScoreBar
          averageScore={averageScore}
          totalPoints={totalPoints}
        />
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
                  isOwn={item.reviewer.id === ownReview?.profileId}
                />
              ))}
            </RecommendationGroup>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Header3 className="text-label">{t('Submitted Reviews')}</Header3>
          <div className="flex flex-col gap-2">
            {reviews.map((item) => (
              <ReviewerRow
                key={item.review.assignmentId}
                item={item}
                showScore={hasScoring}
                totalPoints={totalPoints}
                onSelect={onSelectAssignment}
                isOwn={item.reviewer.id === ownReview?.profileId}
              />
            ))}
          </div>
        </div>
      )}

      {ownReview && !ownReview.hasSubmitted && (
        <Button
          variant="link"
          size="inline"
          onClick={ownReview.onOpenForm}
          className="self-start text-base"
        >
          {t('+ Add review')}
        </Button>
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
  localizedLabel: RecommendationLabels['label'],
): ReviewerGroup[] {
  const order = options.map((o) => String(o.value));
  const titles = new Map(
    options.map((o) => [String(o.value), localizedLabel(o.value) ?? o.title]),
  );

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
        <span className="font-serif text-sm">
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
  isOwn,
}: {
  item: SubmittedReviewItem;
  showScore: boolean;
  totalPoints: number;
  onSelect: (assignmentId: string) => void;
  isOwn?: boolean;
}) {
  const t = useTranslations();
  const reviewerName = item.reviewer.name ?? item.reviewer.slug;
  const rowLabel = isOwn
    ? t('{name} (You)', { name: reviewerName })
    : reviewerName;

  return (
    // `bare`: the row keeps its card look and picks up the sense focus ring,
    // which the hand-rolled outline it used to carry never matched.
    <Button
      variant="bare"
      onClick={() => onSelect(item.review.assignmentId)}
      className="flex h-14 w-full items-center justify-between rounded-lg border border-border bg-white px-3 py-2 text-start transition-colors duration-200 hover:bg-muted"
      aria-label={t('View review by {name}', { name: rowLabel })}
    >
      <div className="flex items-center gap-2">
        <ProfileAvatar
          profile={item.reviewer}
          withLink={false}
          className="size-6"
        />
        <div className="flex flex-col">
          <span className="text-base">{rowLabel}</span>
          {showScore && (
            <span className="text-sm">
              {item.score}
              <span className="text-muted-foreground">/{totalPoints}pts</span>
            </span>
          )}
        </div>
      </div>
      <LuChevronRight className="size-4 text-muted-foreground rtl:-scale-x-100" />
    </Button>
  );
}
