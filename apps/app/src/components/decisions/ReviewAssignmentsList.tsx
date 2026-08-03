'use client';

import { useTrackPageView } from '@/hooks/useTrackPageView';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { getDecisionCommonProperties } from '@op/analytics/client-utils';
import { trpc } from '@op/api/client';
import {
  ProposalReviewAssignmentStatus,
  REVIEW_ASSIGNMENT_SORTS,
  getPhaseReviewSettings,
} from '@op/common/client';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { Suspense } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProposalCount } from './ProposalCount';
import { ProposalMasonry } from './ProposalMasonry';
import { ResponsiveSelect } from './ResponsiveSelect';
import { ReviewAssignmentCard } from './ReviewAssignmentCard';

const ASSIGNMENT_STATUSES = Object.values(ProposalReviewAssignmentStatus) as [
  string,
  ...string[],
];

export function ReviewAssignmentsList({
  processInstanceId,
  decisionSlug,
  canViewReviewers = false,
}: {
  processInstanceId: string;
  decisionSlug: string;
  canViewReviewers?: boolean;
}) {
  const t = useTranslations();

  const [statusFilter, setStatusFilter] = useQueryState(
    'status',
    parseAsStringLiteral(ASSIGNMENT_STATUSES),
  );
  const [sort, setSort] = useQueryState(
    'sort',
    parseAsStringLiteral(REVIEW_ASSIGNMENT_SORTS).withDefault('leastReviewed'),
  );

  const { data, isLoading } = trpc.decision.listReviewAssignments.useQuery({
    processInstanceId,
    ...(statusFilter && {
      status: statusFilter as ProposalReviewAssignmentStatus,
    }),
    sort,
  });

  const assignments = data?.assignments ?? [];
  const proposalIds = assignments.map((a) => a.assignment.proposal.id);

  const { data: aggregatesData } =
    trpc.decision.listWithReviewAggregates.useQuery(
      {
        processInstanceId,
        proposalIds,
      },
      {
        enabled: canViewReviewers && proposalIds.length > 0,
      },
    );

  const [instance] = trpc.decision.getInstance.useSuspenseQuery({
    instanceId: processInstanceId,
  });
  const phases = instance.instanceData?.phases ?? [];
  const currentPhase = phases.find(
    (phase) => phase.phaseId === instance.currentStateId,
  );
  const isByCategory =
    !!currentPhase &&
    getPhaseReviewSettings({ phases }, currentPhase.phaseId).scope ===
      'by_category';

  useTrackPageView(
    'review_queue_viewed',
    getDecisionCommonProperties({
      decisionInstanceId: processInstanceId,
      additionalProps: {
        scope: isByCategory ? 'by_category' : 'all',
        phase_id: currentPhase?.phaseId ?? null,
      },
    }),
    [processInstanceId],
  );

  // Show the category tag only when a by-category reviewer's queue spans more
  // than one category (a single-category queue doesn't need the redundant tag).
  // Default to hiding while the count loads — the conservative choice for the
  // common single-category case avoids a show→hide flicker.
  const { data: reviewerCategories } =
    trpc.decision.listReviewerCategories.useQuery(
      { processInstanceId, phaseId: currentPhase?.phaseId ?? '' },
      { enabled: isByCategory },
    );
  const showCategory = isByCategory
    ? (reviewerCategories?.length ?? 0) > 1
    : true;

  // Match the "Other proposals" tab: no toolbar when the queue is genuinely
  // empty. A filtered-to-empty result keeps it so the filter can be cleared.
  const showToolbar = assignments.length > 0 || Boolean(statusFilter);

  return (
    <div className="flex flex-col gap-6">
      {showToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* min-w-0 + flex-1 lets the category suffix ellipsize before the filters */}
          <div className="flex min-w-0 flex-1 items-baseline gap-1">
            <ProposalCount count={assignments.length} />
            {/* decorative — a failed lookup must not take down the queue */}
            <APIErrorBoundary fallbacks={{ default: () => null }}>
              <Suspense fallback={null}>
                <AssignedCategoriesSuffix
                  processInstanceId={processInstanceId}
                />
              </Suspense>
            </APIErrorBoundary>
          </div>
          <div className="grid max-w-fit grid-cols-2 justify-end gap-2 sm:flex sm:flex-1 sm:flex-wrap sm:items-center sm:justify-end">
            <ResponsiveSelect
              selectedKey={statusFilter ?? 'all'}
              onSelectionChange={(key) =>
                setStatusFilter(key === 'all' ? null : key)
              }
              aria-label={t('Filter by status')}
              items={[
                { id: 'all', label: t('All statuses') },
                { id: 'pending', label: t('Not Started') },
                { id: 'in_progress', label: t('In Progress') },
                { id: 'completed', label: t('Completed') },
                {
                  id: 'awaiting_author_revision',
                  label: t('Revision Requested'),
                },
                { id: 'ready_for_re_review', label: t('Needs Review') },
              ]}
            />
            <ResponsiveSelect
              selectedKey={sort}
              onSelectionChange={(key) =>
                setSort(key as (typeof REVIEW_ASSIGNMENT_SORTS)[number])
              }
              aria-label={t('Sort order')}
              items={[
                { id: 'leastReviewed', label: t('Least reviewed') },
                { id: 'newest', label: t('Newest First') },
                { id: 'oldest', label: t('Oldest First') },
              ]}
            />
          </div>
        </div>
      )}

      {/* Cards grid */}
      {isLoading ? (
        <ReviewAssignmentListSkeletonGrid />
      ) : assignments.length === 0 ? (
        <EmptyState icon={<LuLeaf className="size-6" />}>
          <Header3 className="font-serif !text-title-base font-light text-neutral-black">
            {statusFilter
              ? t('No reviews found matching the current filters.')
              : t('No reviews assigned yet')}
          </Header3>
          <p className="text-base text-neutral-charcoal">
            {statusFilter
              ? t('Try adjusting your filter selection above.')
              : t('Review assignments will appear here once they are created.')}
          </p>
        </EmptyState>
      ) : (
        <ProposalMasonry>
          {assignments.map((item) => (
            <ReviewAssignmentCard
              key={item.assignment.id}
              assignment={item}
              viewHref={`/decisions/${decisionSlug}/reviews/${item.assignment.id}`}
              reviewers={
                aggregatesData?.items.find(
                  (i) => i.proposal.id === item.assignment.proposal.id,
                )?.aggregates.reviewers
              }
              showCategory={showCategory}
            />
          ))}
        </ProposalMasonry>
      )}
    </div>
  );
}

/** "in District 1, District 2" suffix after the count on by-category phases. */
const AssignedCategoriesSuffix = ({
  processInstanceId,
}: {
  processInstanceId: string;
}) => {
  // cached from the page-level suspense query — no extra request
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({
    instanceId: processInstanceId,
  });

  const phases = instance.instanceData?.phases ?? [];
  const currentPhase = phases.find(
    (phase) => phase.phaseId === instance.currentStateId,
  );

  if (
    !currentPhase ||
    getPhaseReviewSettings({ phases }, currentPhase.phaseId).scope !==
      'by_category'
  ) {
    return null;
  }

  return (
    <AssignedCategoriesLabel
      processInstanceId={processInstanceId}
      phaseId={currentPhase.phaseId}
    />
  );
};

const AssignedCategoriesLabel = ({
  processInstanceId,
  phaseId,
}: {
  processInstanceId: string;
  phaseId: string;
}) => {
  const t = useTranslations();

  const [categories] = trpc.decision.listReviewerCategories.useSuspenseQuery({
    processInstanceId,
    phaseId,
  });

  if (categories.length === 0) {
    return null;
  }

  const label = t('in {categories}', {
    categories: categories.map((category) => category.name).join(', '),
  });

  return (
    <span
      className="min-w-0 truncate text-base text-neutral-gray4"
      title={label}
    >
      {label}
    </span>
  );
};

const ReviewAssignmentCardSkeleton = () => (
  <Surface className="relative w-full space-y-3 p-4 pb-4">
    {/* Title */}
    <Skeleton className="h-6 w-3/4" />

    {/* Author + category */}
    <div className="flex items-center gap-2">
      <Skeleton className="size-6 rounded-full" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="size-1 rounded-full" />
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>

    {/* Description (2 lines) */}
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>

    {/* Status badge */}
    <Skeleton className="h-8 w-28 rounded-lg" />
  </Surface>
);

const ReviewAssignmentListSkeletonGrid = () => (
  <div className="columns-1 gap-6 md:columns-2 lg:columns-3 [&>*]:mb-6 [&>*]:break-inside-avoid">
    {Array.from({ length: 6 }).map((_, index) => (
      <ReviewAssignmentCardSkeleton key={index} />
    ))}
  </div>
);
