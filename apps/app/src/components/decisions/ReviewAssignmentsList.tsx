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
import { Card } from '@op/sense/Card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Skeleton } from '@op/sense/Skeleton';
import { cn } from '@op/sense/lib/utils';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { Suspense } from 'react';
import {
  LuCircleAlert,
  LuCircleCheck,
  LuCircleDashed,
  LuLeaf,
  LuListFilter,
  LuRefreshCw,
  LuTimer,
} from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProposalCount } from './ProposalCount';
import { ProposalMasonry } from './ProposalMasonry';
import { ResponsiveSelect } from './ResponsiveSelect';
import { ReviewAssignmentCard } from './ReviewAssignmentCard';
import { StickyFilterBar } from './StickyFilterBar';

const ASSIGNMENT_STATUSES = Object.values(ProposalReviewAssignmentStatus) as [
  string,
  ...string[],
];

export function ReviewAssignmentsList({
  processInstanceId,
  decisionSlug,
  canViewReviewers = false,
  pinOffset,
}: {
  processInstanceId: string;
  decisionSlug: string;
  canViewReviewers?: boolean;
  /** Px offset where the filter bar pins (clears the floating phase toggle). */
  pinOffset?: number;
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

  // cached from the page-level suspense query — no extra request
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

  // Match the status-badge icon + accent for each status (see
  // ReviewAssignmentCard); "All statuses" gets a neutral filter glyph.
  const statusFilterItems = (
    [
      {
        id: 'all',
        label: t('All statuses'),
        icon: LuListFilter,
        iconClass: 'text-muted-foreground',
      },
      {
        id: 'pending',
        label: t('Not Started'),
        icon: LuCircleDashed,
        iconClass: 'text-muted-foreground',
      },
      {
        id: 'in_progress',
        label: t('In Progress'),
        icon: LuTimer,
        iconClass: 'text-teal-600',
      },
      {
        id: 'completed',
        label: t('Completed'),
        icon: LuCircleCheck,
        iconClass: 'text-success',
      },
      {
        id: 'awaiting_author_revision',
        label: t('Revision Requested'),
        icon: LuRefreshCw,
        iconClass: 'text-warning',
      },
      {
        id: 'ready_for_re_review',
        label: t('Needs Review'),
        icon: LuCircleAlert,
        iconClass: 'text-warning',
      },
    ] as const
  ).map(({ id, label, icon: Icon, iconClass }) => ({
    id,
    textValue: label,
    label: (
      <span className="flex items-center gap-2">
        <Icon className={cn('size-4 shrink-0', iconClass)} aria-hidden />
        {label}
      </span>
    ),
  }));

  return (
    <div className="relative flex flex-col gap-6">
      {showToolbar && (
        <StickyFilterBar pinOffset={pinOffset}>
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
          <div className="scrollbar-none flex items-center gap-4 max-md:-mx-4 max-md:w-screen max-md:overflow-x-scroll max-md:px-4">
            <ResponsiveSelect
              selectedKey={statusFilter ?? 'all'}
              onSelectionChange={(key) =>
                setStatusFilter(key === 'all' ? null : key)
              }
              aria-label={t('Filter by status')}
              className="min-w-40"
              items={statusFilterItems}
            />
            <ResponsiveSelect
              selectedKey={sort}
              onSelectionChange={(key) =>
                setSort(key as (typeof REVIEW_ASSIGNMENT_SORTS)[number])
              }
              aria-label={t('Sort order')}
              className="min-w-40"
              items={[
                { id: 'leastReviewed', label: t('Least reviewed') },
                { id: 'newest', label: t('Newest First') },
                { id: 'oldest', label: t('Oldest First') },
              ]}
            />
          </div>
        </StickyFilterBar>
      )}

      {/* Cards grid */}
      {isLoading ? (
        <ReviewAssignmentListSkeletonGrid />
      ) : assignments.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LuLeaf className="size-6" />
            </EmptyMedia>
            <EmptyTitle>
              {statusFilter
                ? t('No reviews found matching the current filters.')
                : t('No reviews assigned yet')}
            </EmptyTitle>
            <EmptyDescription>
              {statusFilter
                ? t('Try adjusting your filter selection above.')
                : t(
                    'Review assignments will appear here once they are created.',
                  )}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
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
      className="min-w-0 truncate text-base text-muted-foreground"
      title={label}
    >
      {label}
    </span>
  );
};

const ReviewAssignmentCardSkeleton = () => (
  <Card className="relative w-full space-y-3 p-4 pb-4 shadow-none">
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
  </Card>
);

const ReviewAssignmentListSkeletonGrid = () => (
  <div className="columns-1 gap-6 md:columns-2 lg:columns-3 [&>*]:mb-6 [&>*]:break-inside-avoid">
    {Array.from({ length: 6 }).map((_, index) => (
      <ReviewAssignmentCardSkeleton key={index} />
    ))}
  </div>
);
