'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import {
  type DevelopOriginEntry,
  type DevelopOriginScope,
  type Proposal,
  type ProposalWithAggregates,
  nextCursor,
  resolveReviewSettings,
} from '@op/common/client';
import { useInfiniteScroll } from '@op/hooks';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import {
  FooterBar,
  FooterBarCenter,
  FooterBarEnd,
  FooterBarStart,
} from '@op/sense/FooterBar';
import { Header3 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import { Tabs, TabsContent } from '@op/sense/Tabs';
import { toast } from '@op/sense/Toast';
import { notFound } from 'next/navigation';
import {
  type ReactNode,
  Suspense,
  useCallback,
  useDeferredValue,
  useState,
  useTransition,
} from 'react';
import { LuCircleCheck } from 'react-icons/lu';

import { useRouter, useTranslations } from '@/lib/i18n';

import { CategoryFilterSelect } from '../CategoryFilterSelect';
import { ProposalTabList, ProposalTabTrigger } from '../Proposal/ProposalTabs';
import { ProposalsLoadError } from '../ProposalsLoadError';
import { ResponsiveSelect } from '../ResponsiveSelect';
import {
  ReviewSelectionTable,
  ReviewSelectionTableSkeleton,
} from '../ReviewSelection/ReviewSelectionTable';
import { ALL_CATEGORIES } from '../proposalFilterQuery';
import { proposalEditHref } from '../proposalHrefs';
import { DevelopEntriesTable } from './DevelopEntriesTable';
import { DevelopOriginActions } from './DevelopOriginActions';
import { DevelopOriginsTable } from './DevelopOriginsTable';
import { NoOriginsEmpty } from './NoOriginsEmpty';

type DevelopTab = 'proposals' | 'ballot';
type OriginSort = 'newest' | 'oldest';

/**
 * The develop screen's body, in two tabs. Proposals lists the previous phase's
 * proposals (the origins): an admin sees every one, with a category filter;
 * anyone else sees the ones assigned to them. Each has a Prepare action that
 * creates an entry in the current phase and opens it in the proposal editor.
 * Ballot lists the caller's own entries of the current phase, drafts included,
 * each with the origins it was developed from.
 *
 * An origin the caller already developed links to that entry instead, with
 * Advance to mark the entry ready. Filtering, sorting, paging and counting all
 * happen in the API.
 */
export function DevelopProposalsListSuspense({
  instance,
  originPhaseId,
}: {
  instance: ProcessInstance;
  /** The phase the origins come from: the one before the develop phase. */
  originPhaseId: string;
}) {
  const t = useTranslations('decisions.develop');
  const router = useRouter();
  const utils = trpc.useUtils();
  const processInstanceId = instance.id;
  const decisionSlug = instance.slug;

  if (!decisionSlug) {
    notFound();
  }

  const isAdmin = Boolean(instance.access?.admin);
  // An admin sees every origin; anyone else the ones assigned to them.
  const scope: DevelopOriginScope = isAdmin ? 'all' : 'assigned';

  const [tab, setTab] = useState<DevelopTab>('proposals');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [sort, setSort] = useState<OriginSort>('newest');
  // A filter change keeps the current rows on screen while the next ones load,
  // instead of swapping the whole list for its skeleton.
  const [, startFiltering] = useTransition();
  const [isNavigating, startNavigating] = useTransition();

  // Mirrors the server's `canReadPhaseReviews`, which gates the aggregates read.
  const canReadReviews =
    isAdmin ||
    (Boolean(instance.access?.review) &&
      resolveReviewSettings(instance.instanceData ?? {}, originPhaseId)
        .openReviews);

  // One row is enough: only the counts and the budget total are read here.
  const [[{ items: categories }, entriesSummary]] = trpc.useSuspenseQueries(
    (q) => [
      q.decision.getCategories({ processInstanceId }),
      q.decision.listOwnDevelopedProposals({ processInstanceId, limit: 1 }),
    ],
  );

  const categoryId =
    isAdmin && selectedCategory !== ALL_CATEGORIES
      ? selectedCategory
      : undefined;
  const [{ pages }, { fetchNextPage, hasNextPage, isFetchingNextPage }] =
    trpc.decision.listDevelopOrigins.useSuspenseInfiniteQuery(
      {
        processInstanceId,
        scope,
        categoryId,
        dir: sort === 'oldest' ? 'asc' : 'desc',
      },
      { getNextPageParam: nextCursor },
    );

  const origins = pages.flatMap((page) => page.items);
  const originsTotal = pages[0]?.total ?? 0;
  // The API returns the caller's entry for each listed origin that has one.
  const entryByOriginId = new Map<string, DevelopOriginEntry>(
    pages.flatMap((page) =>
      page.ownEntries.map((entry) => [entry.originId, entry] as const),
    ),
  );
  const categoryName = categoryId
    ? categories.find((category) => category.id === categoryId)?.name
    : undefined;

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

  const editHref = (proposal: Pick<Proposal, 'profileId'>) =>
    proposalEditHref({
      decisionSlug,
      slug: decisionSlug,
      instanceId: processInstanceId,
      profileId: proposal.profileId,
    });

  const invalidateLists = () => {
    void utils.decision.listDevelopOrigins.invalidate({ processInstanceId });
    void utils.decision.listOwnDevelopedProposals.invalidate({
      processInstanceId,
    });
    void utils.decision.listProposals.invalidate({ processInstanceId });
  };

  const createEntry = trpc.decision.createDevelopedProposal.useMutation({
    onSuccess: (entry) => {
      invalidateLists();
      void utils.decision.getInstance.invalidate({
        instanceId: processInstanceId,
      });
      startNavigating(() => {
        router.push(editHref(entry));
      });
    },
    onError: (error) => {
      logger.error('Failed to prepare a develop entry', { error });
      toast.error(t('prepareEntryError'));
    },
  });

  const submitEntry = trpc.decision.submitDevelopedProposal.useMutation({
    onSuccess: invalidateLists,
    onError: (error) => {
      logger.error('Failed to mark a develop entry ready', { error });
      toast.error(t('advanceEntryError'));
    },
  });

  const isPreparing = createEntry.isPending || isNavigating;
  const preparingOriginId = isPreparing
    ? (createEntry.variables?.sourceProposalIds[0] ?? null)
    : null;
  const advancingEntryId = submitEntry.isPending
    ? (submitEntry.variables?.proposalId ?? null)
    : null;

  const renderPrepare = (origin: Proposal) => {
    const entry = entryByOriginId.get(origin.id);

    return (
      <DevelopOriginActions
        title={origin.profile.name || t('untitledProposal')}
        entry={entry}
        entryHref={editHref}
        isDisabled={isPreparing || submitEntry.isPending}
        isPreparing={preparingOriginId === origin.id}
        isAdvancing={!!entry && advancingEntryId === entry.id}
        onPrepare={() =>
          createEntry.mutate({
            processInstanceId,
            sourceProposalIds: [origin.id],
            proposalData: {
              title: origin.profile.name,
              category: origin.proposalData.category,
            },
          })
        }
        onAdvance={(developed) =>
          submitEntry.mutate({ proposalId: developed.id })
        }
      />
    );
  };

  const heading = !isAdmin
    ? t('assignedOriginsCount', { count: originsTotal })
    : categoryName
      ? t.rich('originsInCategoryCount', {
          count: originsTotal,
          category: categoryName,
          bdi: (chunks) => <bdi>{chunks}</bdi>,
        })
      : t('originsCount', { count: originsTotal });

  return (
    <div className="flex flex-col gap-6 pb-20">
      <Tabs
        value={tab}
        onValueChange={(value: DevelopTab) => setTab(value)}
        className="gap-6"
      >
        <ProposalTabList aria-label={t('tabsLabel')} className="-ms-3">
          <ProposalTabTrigger value="proposals">
            {t('proposalsTab')}
          </ProposalTabTrigger>
          <ProposalTabTrigger value="ballot" count={entriesSummary.total}>
            {t('ballotTab')}
          </ProposalTabTrigger>
        </ProposalTabList>

        <TabsContent
          value="proposals"
          className="flex grow flex-col gap-6 sm:p-0"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div aria-live="polite">
              <Header3>{heading}</Header3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && categories.length > 0 ? (
                <CategoryFilterSelect
                  decisionSlug={decisionSlug}
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onSelectCategory={(category) =>
                    startFiltering(() => setSelectedCategory(category))
                  }
                />
              ) : null}
              <ResponsiveSelect<OriginSort>
                selectedKey={sort}
                onSelectionChange={(next) =>
                  startFiltering(() => setSort(next))
                }
                aria-label={t('sortLabel')}
                items={[
                  { id: 'newest', label: t('sortNewestOption') },
                  { id: 'oldest', label: t('sortOldestOption') },
                ]}
              />
            </div>
          </div>

          <div aria-live="polite" className="flex flex-col">
            {origins.length === 0 ? (
              <NoOriginsEmpty isAssignedOnly={!isAdmin} />
            ) : canReadReviews ? (
              <APIErrorBoundary
                fallbacks={{ default: () => <ProposalsLoadError /> }}
              >
                <Suspense
                  fallback={
                    <ReviewSelectionTableSkeleton
                      showScore={false}
                      showBudget={false}
                    />
                  }
                >
                  <OriginsWithReviewsSuspense
                    processInstanceId={processInstanceId}
                    originPhaseId={originPhaseId}
                    origins={origins}
                    decisionSlug={decisionSlug}
                    actionLabel={t('actionsColumn')}
                    renderPrepare={renderPrepare}
                  />
                </Suspense>
              </APIErrorBoundary>
            ) : (
              <DevelopOriginsTable
                origins={origins}
                renderAction={renderPrepare}
              />
            )}
            {/* `aria-hidden` keeps the trigger out of the a11y tree; the line
              below announces loading instead. */}
            {shouldShowTrigger ? (
              <div ref={infiniteScrollRef} aria-hidden className="py-4">
                {isFetchingNextPage ? (
                  <ReviewSelectionTableSkeleton
                    showScore={false}
                    showBudget={false}
                  />
                ) : null}
              </div>
            ) : null}
            <span className="sr-only">
              {isFetchingNextPage ? t('loadingMore') : ''}
            </span>
          </div>
        </TabsContent>

        <TabsContent value="ballot" className="grow sm:p-0">
          <DevelopEntriesTable
            processInstanceId={processInstanceId}
            entriesTotal={entriesSummary.total}
            budgetTotal={entriesSummary.budgetTotal}
            editHref={editHref}
          />
        </TabsContent>
      </Tabs>

      <FooterBar position="fixed" className="bg-muted/95">
        <FooterBarStart>
          <p aria-live="polite" className="flex items-center gap-2 text-base">
            <LuCircleCheck className="size-5 shrink-0" aria-hidden />
            {t('advancingCount', { count: entriesSummary.readyTotal })}
          </p>
        </FooterBarStart>
        <FooterBarCenter />
        <FooterBarEnd>
          {/* Confirm is not built yet; the disabled button holds its place. */}
          <Button disabled>{t('confirmSelectionsAction')}</Button>
        </FooterBarEnd>
      </FooterBar>
    </div>
  );
}

export function DevelopProposalsListSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-4 border-b pb-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-40" />
      </div>
      <ReviewSelectionTableSkeleton showScore={false} showBudget={false} />
    </div>
  );
}

/**
 * The loaded origins with their review recommendations, in the origins' own
 * order. The aggregates are a keyed read for exactly the loaded origins: the
 * filtered read is the one a reviewer may make on a phase with open reviews.
 * A newly loaded page keeps the rows on screen until its aggregates arrive.
 */
function OriginsWithReviewsSuspense({
  processInstanceId,
  originPhaseId,
  origins,
  decisionSlug,
  actionLabel,
  renderPrepare,
}: {
  processInstanceId: string;
  originPhaseId: string;
  origins: Proposal[];
  decisionSlug: string;
  actionLabel: string;
  renderPrepare: (origin: Proposal) => ReactNode;
}) {
  const shownOrigins = useDeferredValue(origins);
  const [{ items }] = trpc.decision.listWithReviewAggregates.useSuspenseQuery({
    processInstanceId,
    phaseId: originPhaseId,
    proposalIds: shownOrigins.map((origin) => origin.id),
  });

  const aggregatesById = new Map<string, ProposalWithAggregates>(
    items.map((item) => [item.proposal.id, item] as const),
  );
  const rows = shownOrigins.flatMap((origin) => {
    const row = aggregatesById.get(origin.id);
    return row ? [row] : [];
  });

  return (
    <ReviewSelectionTable
      items={rows}
      totalPoints={0}
      showScore={false}
      showBudget={false}
      showCategory={false}
      decisionSlug={decisionSlug}
      action={{
        label: actionLabel,
        render: (item) => renderPrepare(item.proposal),
      }}
    />
  );
}
