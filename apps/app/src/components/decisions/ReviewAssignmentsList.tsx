'use client';

import { useTrackPageView } from '@/hooks/useTrackPageView';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { getDecisionCommonProperties } from '@op/analytics/client-utils';
import { trpc } from '@op/api/client';
import { type DecisionAccess } from '@op/api/encoders';
import {
  type Proposal,
  ProposalReviewAssignmentStatus,
  REVIEW_ASSIGNMENT_SORTS,
  getPhaseReviewSettings,
} from '@op/common/client';
import { useInfiniteScroll } from '@op/hooks';
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
import { type ReactNode, Suspense, useCallback, useMemo } from 'react';
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

import { MobileViewSwitch } from './MobileViewSwitch';
import { ProposalCount } from './ProposalCount';
import { ProposalMasonry } from './ProposalMasonry';
import { ProposalTranslationProvider } from './ProposalTranslationContext';
import { ProposalViewToggle } from './ProposalViewToggle';
import { ReviewAssignmentsMapWithLocations } from './ProposalsMapView';
import { ResponsiveSelect } from './ResponsiveSelect';
import { ReviewAssignmentCard } from './ReviewAssignmentCard';
import { StickyFilterBar } from './StickyFilterBar';
import { TranslateBanner } from './TranslateBanner';
import {
  useDecisionNeedsTranslation,
  useRegisterTranslationSamples,
} from './TranslationDetectionContext';
import { TranslationNotice } from './TranslationNotice';
import { getProposalDetectionText } from './translationDetectionText';
import { useProposalViewMode } from './useProposalViewMode';
import { useTranslateDecision } from './useTranslateDecision';

const ASSIGNMENT_STATUSES = Object.values(ProposalReviewAssignmentStatus) as [
  string,
  ...string[],
];

export function ReviewAssignmentsList({
  processInstanceId,
  decisionSlug,
  decisionProfileId,
  access,
  pinOffset,
}: {
  processInstanceId: string;
  decisionSlug: string;
  /** Decision profile whose phase copy, updates and resources translate with the queue. */
  decisionProfileId?: string | null;
  access?: DecisionAccess;
  /** Px offset where the filter bar pins (clears the floating phase toggle). */
  pinOffset?: number;
}) {
  const canViewReviewers = Boolean(access?.admin);
  const t = useTranslations();

  const [statusFilter, setStatusFilter] = useQueryState(
    'status',
    parseAsStringLiteral(ASSIGNMENT_STATUSES),
  );
  const [sort, setSort] = useQueryState(
    'sort',
    parseAsStringLiteral(REVIEW_ASSIGNMENT_SORTS).withDefault('leastReviewed'),
  );

  // cached from the page-level suspense query — no extra request
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({
    instanceId: processInstanceId,
  });
  const phases = instance.instanceData?.phases ?? [];
  const currentPhase = phases.find(
    (phase) => phase.phaseId === instance.currentStateId,
  );

  // The tab is only mounted on a review phase; a stateless instance is a bug
  // for the error boundary, not a fallback (same guard as ManualSelectionList).
  if (!instance.currentStateId) {
    throw new Error('ReviewAssignmentsList: instance has no currentStateId');
  }
  const phaseId = instance.currentStateId;

  const queueInput = {
    processInstanceId,
    phaseId,
    ...(statusFilter && {
      status: statusFilter as ProposalReviewAssignmentStatus,
    }),
    sort,
  };

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.decision.listReviewAssignments.useInfiniteQuery(queueInput, {
      getNextPageParam: (lastPage) => lastPage.next ?? undefined,
    });

  const assignments = useMemo(
    () => data?.pages.flatMap((page) => page.assignments) ?? [],
    [data?.pages],
  );
  const total = data?.pages[0]?.total ?? 0;
  const proposalIds = assignments.map((a) => a.assignment.proposal.id);

  const loadNextPage = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  const { ref: infiniteScrollRef, shouldShowTrigger } =
    useInfiniteScroll<HTMLDivElement>(loadNextPage, {
      hasNextPage,
      isFetchingNextPage,
      threshold: 0.1,
      rootMargin: '50px',
    });

  // The reviewer's queue renders the same proposal cards as the "Other
  // proposals" tab, so it gets the same translation wiring — without it the two
  // tabs disagreed, one offering translation and one not.
  const assignedProposals = useMemo(
    () => assignments.map((item) => item.assignment.proposal),
    [assignments],
  );
  const proposalSamples = useMemo(
    () => assignedProposals.map(getProposalDetectionText),
    [assignedProposals],
  );
  // A review phase mounts this tab and unmounts the "Other proposals" list
  // beside it, so this is the only proposal surface on the screen. Detecting
  // from the queue alone left everything else the control translates — the
  // decision copy, the updates, the resources — with no way to reach it.
  useRegisterTranslationSamples('review-assignments', proposalSamples);
  const needsTranslation = useDecisionNeedsTranslation();
  const translation = useTranslateDecision({
    proposals: assignedProposals,
    decisionProfileId,
    needsTranslation,
  });

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

  // Map mode is offered on the same terms as browse (location field + GIS
  // flag), but leads with the grid: reviewing a queue is sequential work and
  // the map is the secondary lens.
  const {
    hasLocationField,
    mapView,
    effectiveView,
    isMapMode,
    handleViewChange,
  } = useProposalViewMode(instance.instanceData?.proposalTemplate, {
    defaultView: 'grid',
  });

  // The proposal-keyed URL resolves per viewer (own review screen for a
  // reviewer, review progress for an admin). Card, pin and hovercard all use
  // it, so they can't disagree about where a proposal leads.
  const reviewsHref = useCallback(
    (proposal: Pick<Proposal, 'profileId'>) =>
      `/decisions/${decisionSlug}/proposal/${proposal.profileId}/reviews`,
    [decisionSlug],
  );

  const reviewersByProposalId = useMemo(
    () =>
      new Map(
        (aggregatesData?.items ?? []).map((item) => [
          item.proposal.id,
          item.aggregates.reviewers,
        ]),
      ),
    [aggregatesData],
  );

  // The tab is the filter: pins come from the assignments themselves, so the
  // map never plots a proposal this reviewer isn't assigned.
  const assignmentByProposalId = useMemo(
    () =>
      new Map(assignments.map((item) => [item.assignment.proposal.id, item])),
    [assignments],
  );

  // `useCallback` is load-bearing: the map view's list rows are memoized on
  // this function, so a fresh one every render would re-render the whole
  // column on each hover.
  const renderCard = useCallback(
    (proposal: Proposal, { className }: { className: string }) => {
      const assignment = assignmentByProposalId.get(proposal.id);
      if (!assignment) {
        return null;
      }
      return (
        <ReviewAssignmentCard
          assignment={assignment}
          viewHref={reviewsHref(proposal)}
          reviewsHref={reviewsHref(proposal)}
          reviewers={reviewersByProposalId.get(proposal.id)}
          access={access}
          showCategory={showCategory}
          className={className}
        />
      );
    },
    [
      assignmentByProposalId,
      reviewersByProposalId,
      reviewsHref,
      access,
      showCategory,
    ],
  );

  // Shared by both views. `aria-hidden` keeps the trigger out of the a11y
  // tree; the `aria-live` line at the bottom announces loading instead.
  const renderScrollSentinel = (skeleton: ReactNode) =>
    shouldShowTrigger ? (
      <div
        ref={infiniteScrollRef}
        aria-hidden
        className="py-4"
        data-testid="review-assignments-infinite-scroll-sentinel"
      >
        {isFetchingNextPage ? skeleton : null}
      </div>
    ) : null;

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
            <ProposalCount count={total} />
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
            {hasLocationField && (
              // Desktop control; below `sm` the floating MobileViewSwitch
              // below takes over (same split as the proposals list).
              <div className="hidden items-center gap-4 sm:flex">
                <span aria-hidden className="h-6 w-px bg-border" />
                <ProposalViewToggle
                  value={effectiveView}
                  onChange={handleViewChange}
                />
              </div>
            )}
          </div>
        </StickyFilterBar>
      )}

      {translation.translationState && (
        <TranslationNotice
          sourceLanguageName={translation.sourceLanguageName}
          onViewOriginal={translation.handleViewOriginal}
        />
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
        <ProposalTranslationProvider
          translations={translation.translationState?.translations ?? {}}
        >
          {isMapMode ? (
            // Local boundaries keep the filter bar mounted while pins load or fail.
            <APIErrorBoundary
              fallbacks={{
                default: () => (
                  <div className="py-8 text-center text-base">
                    {t("Couldn't load the map. Refresh to try again.")}
                  </div>
                ),
              }}
            >
              <Suspense fallback={<ReviewAssignmentListSkeletonGrid />}>
                {/* Pins come from their own query so the map isn't capped by
                    the page size; the list column still pages via listFooter. */}
                <ReviewAssignmentsMapWithLocations
                  proposals={assignedProposals}
                  renderCard={renderCard}
                  hrefFor={reviewsHref}
                  mapView={mapView}
                  locationFilter={{
                    processInstanceId: queueInput.processInstanceId,
                    phaseId: queueInput.phaseId,
                    status: queueInput.status,
                  }}
                  listFooter={renderScrollSentinel(
                    <ReviewAssignmentCardSkeleton />,
                  )}
                />
              </Suspense>
            </APIErrorBoundary>
          ) : (
            <ProposalMasonry loadingMore={isFetchingNextPage}>
              {assignments.map((item) => (
                <ReviewAssignmentCard
                  key={item.assignment.id}
                  assignment={item}
                  viewHref={reviewsHref(item.assignment.proposal)}
                  reviewers={reviewersByProposalId.get(
                    item.assignment.proposal.id,
                  )}
                  reviewsHref={reviewsHref(item.assignment.proposal)}
                  access={access}
                  showCategory={showCategory}
                />
              ))}
            </ProposalMasonry>
          )}
        </ProposalTranslationProvider>
      )}

      {/* Grid mode: the masonry renders its own load-more skeletons. */}
      {!isMapMode && renderScrollSentinel(null)}

      <p aria-live="polite" className="sr-only">
        {isFetchingNextPage ? t('Loading more proposals') : ''}
      </p>

      {translation.showBanner && (
        <TranslateBanner
          onTranslate={translation.handleTranslate}
          onDismiss={translation.dismissBanner}
          isTranslating={translation.isTranslating}
          languageName={translation.targetLanguageName}
        />
      )}

      {hasLocationField && (
        <MobileViewSwitch view={effectiveView} onChange={handleViewChange} />
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
