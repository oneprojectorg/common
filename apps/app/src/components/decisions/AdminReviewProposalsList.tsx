'use client';

import { useAnyContentNeedsTranslation } from '@/hooks/useAnyContentNeedsTranslation';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { type DecisionAccess } from '@op/api/encoders';
import {
  PROPOSAL_REVIEW_STATUSES,
  type Proposal,
  type ProposalReviewAggregates,
  REVIEW_ASSIGNMENT_SORTS,
} from '@op/common/client';
import { useInfiniteScroll } from '@op/hooks';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { cn } from '@op/sense/lib/utils';
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs';
import { Suspense, useCallback, useMemo } from 'react';
import {
  LuCircleCheck,
  LuCircleDashed,
  LuLeaf,
  LuListFilter,
  LuTimer,
} from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { TranslatedText } from '@/components/TranslatedText';

import { ALL_CATEGORIES, CategoryFilterSelect } from './CategoryFilterSelect';
import { MobileViewSwitch } from './MobileViewSwitch';
import { ProposalCardView } from './ProposalCard';
import { ProposalListSkeleton } from './ProposalListSkeleton';
import { ProposalMasonry } from './ProposalMasonry';
import { ProposalReviewsCount } from './ProposalReviewsCount';
import { ProposalTranslationProvider } from './ProposalTranslationContext';
import { ProposalViewToggle } from './ProposalViewToggle';
import { ProposalsMapView } from './ProposalsMapView';
import { ResponsiveSelect } from './ResponsiveSelect';
import { ProposalReviewStatusBadge } from './ReviewStatusBadge';
import { StickyFilterBar } from './StickyFilterBar';
import { TranslateBanner } from './TranslateBanner';
import { TranslationNotice } from './TranslationNotice';
import { getProposalDetectionText } from './translationDetectionText';
import { useProposalViewMode } from './useProposalViewMode';
import { useTranslateDecision } from './useTranslateDecision';

interface AdminReviewProposalsListProps {
  processInstanceId: string;
  decisionSlug: string;
  /** Decision profile whose phase copy, updates and resources translate with the list. */
  decisionProfileId?: string | null;
  access?: DecisionAccess;
  /** Px offset where the filter bar pins (clears the floating phase toggle). */
  pinOffset?: number;
}

// A multiple of three so a full page fills the three-per-row grid evenly. Each
// page carries per-proposal review aggregates, so it stays small — infinite
// scroll pulls further pages as needed.
const PAGE_LIMIT = 24;

// Shared by the URL state and the select handlers so the accepted values stay a
// single source of truth; the "all statuses" option parses to null, which is
// exactly how the filter is cleared.
const statusParser = parseAsStringLiteral(PROPOSAL_REVIEW_STATUSES);
const sortParser = parseAsStringLiteral(REVIEW_ASSIGNMENT_SORTS);

/**
 * The admin's "Proposals in review" list: every proposal in the effective
 * phase with its review-progress rollup and completed-review count, filterable
 * by progress and category, sorted least-reviewed first so the proposals
 * nobody has picked up lead.
 *
 * This is the whole review surface for an admin who is not also a reviewer —
 * there is no assignment queue to tab against, so the list owns its own
 * loading and error states rather than leaning on the page's.
 */
export function AdminReviewProposalsList(props: AdminReviewProposalsListProps) {
  return (
    <APIErrorBoundary
      fallbacks={{
        default: () => <AdminReviewProposalsError />,
      }}
    >
      <Suspense fallback={<ProposalListSkeleton />}>
        <AdminReviewProposalsListContent {...props} />
      </Suspense>
    </APIErrorBoundary>
  );
}

// fallow-ignore-next-line complexity
const AdminReviewProposalsListContent = ({
  processInstanceId,
  decisionSlug,
  decisionProfileId,
  access,
  pinOffset,
}: AdminReviewProposalsListProps) => {
  const t = useTranslations();

  const [statusFilter, setStatusFilter] = useQueryState('status', statusParser);
  const [selectedCategory, setSelectedCategory] = useQueryState(
    'category',
    parseAsString.withDefault(ALL_CATEGORIES),
  );
  const [sort, setSort] = useQueryState(
    'sort',
    sortParser.withDefault('leastReviewed'),
  );

  const [[instance, categoriesData]] = trpc.useSuspenseQueries((q) => [
    // cached from the page-level suspense query — no extra request
    q.decision.getInstance({ instanceId: processInstanceId }),
    q.decision.getCategories({ processInstanceId }),
  ]);

  const [pages, query] =
    trpc.decision.listWithReviewAggregates.useSuspenseInfiniteQuery(
      {
        processInstanceId,
        // The list is this phase's work; omitting phaseId would list every phase.
        ...(instance.currentStateId && { phaseId: instance.currentStateId }),
        limit: PAGE_LIMIT,
        ...(statusFilter && { reviewStatus: statusFilter }),
        ...(selectedCategory !== ALL_CATEGORIES && {
          categoryIds: [selectedCategory],
        }),
        sort,
      },
      {
        getNextPageParam: (lastPage) => lastPage.next ?? undefined,
      },
    );

  const items = useMemo(
    () => pages.pages.flatMap((page) => page.items),
    [pages.pages],
  );
  const total = pages.pages[0]?.total ?? 0;

  const proposals = useMemo(() => items.map((item) => item.proposal), [items]);
  const aggregatesByProposalId = useMemo(
    () => new Map(items.map((item) => [item.proposal.id, item.aggregates])),
    [items],
  );

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;
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

  // Same wiring as the reviewer's queue: the two surfaces render the same
  // proposals, so one must not offer translation while the other doesn't.
  const proposalSamples = useMemo(
    () => proposals.map(getProposalDetectionText),
    [proposals],
  );
  const needsTranslation = useAnyContentNeedsTranslation(proposalSamples);
  const translation = useTranslateDecision({
    proposals,
    decisionProfileId,
    needsTranslation,
  });

  // Map mode is offered on the same terms as browse (location field + GIS
  // flag), but leads with the grid: tracking progress is list work and the map
  // is the secondary lens.
  const {
    hasLocationField,
    mapView,
    effectiveView,
    isMapMode,
    handleViewChange,
  } = useProposalViewMode(instance.instanceData?.proposalTemplate, {
    defaultView: 'grid',
  });

  // The proposal-keyed URL routes an admin to the Review Progress screen. Card,
  // pin and hovercard all use it, so they can't disagree about where a proposal
  // leads.
  const reviewsHref = useCallback(
    (proposal: Pick<Proposal, 'profileId'>) =>
      `/decisions/${decisionSlug}/proposal/${proposal.profileId}/reviews`,
    [decisionSlug],
  );

  // `useCallback` is load-bearing: the map view's list rows are memoized on
  // this function, so a fresh one every render would re-render the whole
  // column on each hover.
  const renderCard = useCallback(
    (proposal: Proposal, { className }: { className: string }) => {
      const aggregates = aggregatesByProposalId.get(proposal.id);
      if (!aggregates) {
        return null;
      }
      return (
        <AdminReviewProposalCard
          proposal={proposal}
          aggregates={aggregates}
          reviewsHref={reviewsHref(proposal)}
          access={access}
          className={className}
        />
      );
    },
    [aggregatesByProposalId, reviewsHref, access],
  );

  const hasActiveFilter =
    Boolean(statusFilter) || selectedCategory !== ALL_CATEGORIES;

  // Match the proposals list: no toolbar when the phase genuinely holds nothing.
  // A filtered-to-empty result keeps it so the filter can be cleared.
  const showToolbar = items.length > 0 || hasActiveFilter;

  // Match the rollup badge's icon + accent for each status (see
  // ReviewStatusBadge); "All statuses" gets a neutral filter glyph.
  const statusFilterItems = (
    [
      {
        id: 'all',
        label: t('All statuses'),
        icon: LuListFilter,
        iconClass: 'text-muted-foreground',
      },
      {
        id: 'not_started',
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
        id: 'reviewed',
        label: t('Reviewed'),
        icon: LuCircleCheck,
        iconClass: 'text-success',
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

  // One sentinel definition for both views — map mode renders it inside the
  // list column (via listFooter), grid mode below the grid.
  const scrollSentinel = shouldShowTrigger ? (
    <div
      ref={infiniteScrollRef}
      className="py-4"
      data-testid="admin-review-proposals-infinite-scroll-sentinel"
    />
  ) : null;

  return (
    <div
      className={cn(
        'relative flex flex-col gap-6',
        // On mobile the map view is edge-to-edge and flush to the bottom.
        isMapMode && 'max-sm:pb-0',
      )}
    >
      {showToolbar && (
        <StickyFilterBar pinOffset={pinOffset}>
          {/* min-w-0 + flex-1 lets the heading ellipsize before the filters */}
          <h2
            aria-live="polite"
            className="min-w-0 flex-1 truncate font-serif text-title font-light"
          >
            {t('Proposals in review · {count}', { count: total })}
          </h2>
          <div className="scrollbar-none flex items-center gap-4 max-md:-mx-4 max-md:w-screen max-md:overflow-x-scroll max-md:px-4">
            <ResponsiveSelect
              selectedKey={statusFilter ?? 'all'}
              onSelectionChange={(key) =>
                setStatusFilter(statusParser.parse(key))
              }
              aria-label={t('Filter by status')}
              className="min-w-40"
              items={statusFilterItems}
            />
            <CategoryFilterSelect
              decisionSlug={decisionSlug}
              categories={categoriesData.categories}
              selectedCategory={selectedCategory}
              onSelectCategory={(category) =>
                // Strip the param on "all" so the URL stays clean.
                setSelectedCategory(
                  category === ALL_CATEGORIES ? null : category,
                )
              }
              className="min-w-40"
            />
            <ResponsiveSelect
              selectedKey={sort}
              onSelectionChange={(key) => {
                const parsed = sortParser.parse(key);
                if (parsed) {
                  setSort(parsed);
                }
              }}
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

      {items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LuLeaf className="size-6" />
            </EmptyMedia>
            <EmptyTitle>
              {hasActiveFilter
                ? t('No proposals found matching the current filters.')
                : t('No proposals in review yet')}
            </EmptyTitle>
            <EmptyDescription>
              {hasActiveFilter
                ? t('Try adjusting your filter selection above.')
                : t('Proposals appear here once they reach this phase.')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ProposalTranslationProvider
          translations={translation.translationState?.translations ?? {}}
        >
          {isMapMode ? (
            // Pins come from the loaded pages, same as the list column: the
            // rollup filter and the least-reviewed order live in this query, so
            // a wider all-locations query couldn't reproduce the same set.
            // Scrolling the list column pulls further pages, and their pins.
            <ProposalsMapView
              proposals={proposals}
              pinProposals={proposals}
              renderCard={renderCard}
              hrefFor={reviewsHref}
              mapView={mapView}
              listFooter={scrollSentinel}
            />
          ) : (
            <ProposalMasonry loadingMore={isFetchingNextPage}>
              {items.map((item) => (
                <AdminReviewProposalCard
                  key={item.proposal.id}
                  proposal={item.proposal}
                  aggregates={item.aggregates}
                  reviewsHref={reviewsHref(item.proposal)}
                  access={access}
                />
              ))}
            </ProposalMasonry>
          )}
        </ProposalTranslationProvider>
      )}

      {/* Grid mode: the load-more skeletons render inside the masonry (see
          ProposalMasonry `loadingMore`), so the sentinel is just the trigger. */}
      {!isMapMode && scrollSentinel}

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
};

/**
 * One proposal in the admin list: the standard proposal card plus the review
 * progress rollup and the completed-review count, which links to the
 * proposal's Review Progress screen.
 */
const AdminReviewProposalCard = ({
  proposal,
  aggregates,
  reviewsHref,
  access,
  className,
}: {
  proposal: Proposal;
  aggregates: ProposalReviewAggregates;
  reviewsHref: string;
  access?: DecisionAccess;
  /** Forwarded to the card — carries the map view's active-pin highlight. */
  className?: string;
}) => (
  <ProposalCardView
    proposal={proposal}
    href={reviewsHref}
    className={className}
    status={<ProposalReviewStatusBadge status={aggregates.reviewStatus} />}
    reviewedLabel={
      <ProposalReviewsCount
        reviewers={aggregates.reviewers}
        href={reviewsHref}
        access={access}
        variant="reviewed"
      />
    }
  />
);

const AdminReviewProposalsError = () => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <LuLeaf className="size-6" />
      </EmptyMedia>
      <EmptyTitle>
        <TranslatedText text="We couldn't load proposals" />
      </EmptyTitle>
      <EmptyDescription>
        <TranslatedText text="Please refresh the page to try again." />
      </EmptyDescription>
    </EmptyHeader>
  </Empty>
);
