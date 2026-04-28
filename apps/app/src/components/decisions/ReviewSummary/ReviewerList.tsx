'use client';

import {
  OVERALL_RECOMMENDATION_KEY,
  type ProposalWithSubmittedReviews,
  type RubricTemplateSchema,
  type SubmittedReviewItem,
  parseSchemaOptions,
} from '@op/common/client';
import { Header3 } from '@op/ui/Header';
import { useMemo } from 'react';
import { LuChevronRight } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProfileAvatar } from '../../ProfileAvatar';
import type { ReviewSummaryCapabilities } from './ReviewSummaryPanel';

interface ReviewerListProps {
  aggregates: ProposalWithSubmittedReviews;
  rubricTemplate: RubricTemplateSchema | null;
  capabilities: ReviewSummaryCapabilities;
  onSelectAssignment: (assignmentId: string) => void;
}

export function ReviewerList({
  aggregates,
  rubricTemplate,
  capabilities,
  onSelectAssignment,
}: ReviewerListProps) {
  const t = useTranslations();
  const { reviewsSubmitted, assignmentsTotal, averageScore } =
    aggregates.aggregates;
  const { hasScoring, hasOverallRecommendation, totalPoints } = capabilities;

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
    return groupReviewsByRecommendation(
      aggregates.reviews,
      recommendationOptions,
    );
  }, [aggregates.reviews, hasOverallRecommendation, recommendationOptions]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Header3 className="font-serif !text-title-base text-neutral-black">
          {t('Review Summary')}
        </Header3>
        <p className="text-sm text-neutral-charcoal">
          {t(
            '{submitted} out of {total} reviewers submitted a review for this proposal',
            { submitted: reviewsSubmitted, total: assignmentsTotal },
          )}
        </p>
      </header>

      {hasScoring && (
        <div className="flex items-center justify-between rounded-lg bg-neutral-offWhite p-4">
          <span className="font-serif !text-title-sm text-neutral-black">
            {t('Average Score')}
          </span>
          <span className="font-serif !text-title-sm text-neutral-black">
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
              dotColor={recommendationDotColor(group.value)}
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
          <Header3 className="font-serif !text-title-sm text-neutral-black">
            {t('Submitted Reviews')}
          </Header3>
          <div className="flex flex-col gap-2">
            {aggregates.reviews.map((item) => (
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

function groupReviewsByRecommendation(
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

function recommendationDotColor(value: string): string {
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

function formatScore(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function RecommendationGroup({
  label,
  count,
  dotColor,
  children,
}: {
  label: string;
  count: number;
  dotColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${dotColor}`} aria-hidden />
        <span className="font-serif !text-title-sm14 text-neutral-black">
          {label} ({count})
        </span>
      </div>
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
    <button
      type="button"
      onClick={() => onSelect(item.review.assignmentId)}
      className="flex w-full items-center justify-between rounded-lg border border-neutral-gray1 bg-white px-3 py-2 text-left transition-colors hover:bg-neutral-offWhite focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-teal"
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
          <span className="text-sm text-neutral-black">
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
    </button>
  );
}
