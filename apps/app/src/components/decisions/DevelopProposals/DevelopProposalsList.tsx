'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { ProposalStatus, type ProcessInstance } from '@op/api/encoders';
import {
  type OwnDevelopedProposal,
  PAGE_LIMIT,
  type Proposal,
  type ProposalWithAggregates,
  resolveReviewSettings,
} from '@op/common/client';
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
  useMemo,
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
type OriginSort = 'score' | 'newest';

/**
 * The develop screen's body, in two tabs. Proposals lists the previous phase's
 * proposals (the origins) with their review recommendations, each with a
 * Prepare action that creates an entry in the current phase and opens it in
 * the proposal editor. Ballot lists the caller's own entries of the current
 * phase, drafts included, each with the origins it was developed from.
 *
 * An origin the caller already developed links to that entry instead, with
 * Advance to mark the entry ready.
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

  const [tab, setTab] = useState<DevelopTab>('proposals');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [sort, setSort] = useState<OriginSort>('score');
  // A filter change keeps the current rows on screen while the next ones load,
  // instead of swapping the whole list for its skeleton.
  const [, startFiltering] = useTransition();
  const [isNavigating, startNavigating] = useTransition();

  // Mirrors the server's `canReadPhaseReviews`, which gates the aggregates read.
  const canReadReviews =
    Boolean(instance.access?.admin) ||
    (Boolean(instance.access?.review) &&
      resolveReviewSettings(instance.instanceData ?? {}, originPhaseId)
        .openReviews);

  const [[{ items: categories }, originsList, entriesList]] =
    trpc.useSuspenseQueries((q) => [
      q.decision.getCategories({ processInstanceId }),
      q.decision.listProposals({
        processInstanceId,
        phaseId: originPhaseId,
        categoryId:
          selectedCategory === ALL_CATEGORIES ? undefined : selectedCategory,
        dir: 'desc',
        limit: PAGE_LIMIT.max,
      }),
      q.decision.listOwnDevelopedProposals({ processInstanceId }),
    ]);

  const origins = originsList.items;
  const entries = entriesList.items;
  // Entries come newest first, so an origin maps to its newest entry.
  const entryByOriginId = new Map<string, OwnDevelopedProposal>();
  for (const entry of entries) {
    for (const origin of entry.origins) {
      if (!entryByOriginId.has(origin.id)) {
        entryByOriginId.set(origin.id, entry);
      }
    }
  }
  const advancingCount = entries.filter(
    (entry) => entry.status === ProposalStatus.SUBMITTED,
  ).length;
  const categoryName = categories.find(
    (category) => category.id === selectedCategory,
  )?.name;

  const editHref = (proposal: Pick<Proposal, 'profileId'>) =>
    proposalEditHref({
      decisionSlug,
      slug: decisionSlug,
      instanceId: processInstanceId,
      profileId: proposal.profileId,
    });

  const createEntry = trpc.decision.createDevelopedProposal.useMutation({
    onSuccess: (entry) => {
      void utils.decision.listProposals.invalidate({ processInstanceId });
      void utils.decision.listOwnDevelopedProposals.invalidate({
        processInstanceId,
      });
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
    onSuccess: () => {
      void utils.decision.listProposals.invalidate({ processInstanceId });
      void utils.decision.listOwnDevelopedProposals.invalidate({
        processInstanceId,
      });
    },
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
          <ProposalTabTrigger value="ballot" count={entries.length}>
            {t('ballotTab')}
          </ProposalTabTrigger>
        </ProposalTabList>

        <TabsContent
          value="proposals"
          className="flex grow flex-col gap-6 sm:p-0"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div aria-live="polite">
              <Header3>
                {categoryName
                  ? t.rich('originsInCategoryCount', {
                      count: originsList.total,
                      category: categoryName,
                      bdi: (chunks) => <bdi>{chunks}</bdi>,
                    })
                  : t('originsCount', { count: originsList.total })}
              </Header3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {categories.length > 0 ? (
                <CategoryFilterSelect
                  decisionSlug={decisionSlug}
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onSelectCategory={(category) =>
                    startFiltering(() => setSelectedCategory(category))
                  }
                />
              ) : null}
              {canReadReviews ? (
                <ResponsiveSelect<OriginSort>
                  selectedKey={sort}
                  onSelectionChange={setSort}
                  aria-label={t('sortLabel')}
                  items={[
                    { id: 'score', label: t('sortHighestScoreOption') },
                    { id: 'newest', label: t('sortNewestOption') },
                  ]}
                />
              ) : null}
            </div>
          </div>

          {origins.length === 0 ? (
            <NoOriginsEmpty />
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
                  sort={sort}
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
        </TabsContent>

        <TabsContent value="ballot" className="grow sm:p-0">
          <DevelopEntriesTable entries={entries} editHref={editHref} />
        </TabsContent>
      </Tabs>

      <FooterBar position="fixed" className="bg-muted/95">
        <FooterBarStart>
          <p aria-live="polite" className="flex items-center gap-2 text-base">
            <LuCircleCheck className="size-5 shrink-0" aria-hidden />
            {t('advancingCount', { count: advancingCount })}
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
 * The origins with their review recommendations. The aggregates are read for
 * exactly the listed origins: the filtered read is the one a reviewer may make
 * on a phase with open reviews; the phase-wide read is admin-only.
 */
function OriginsWithReviewsSuspense({
  processInstanceId,
  originPhaseId,
  origins,
  sort,
  decisionSlug,
  actionLabel,
  renderPrepare,
}: {
  processInstanceId: string;
  originPhaseId: string;
  origins: Proposal[];
  sort: OriginSort;
  decisionSlug: string;
  actionLabel: string;
  renderPrepare: (origin: Proposal) => ReactNode;
}) {
  const [{ items }] = trpc.decision.listWithReviewAggregates.useSuspenseQuery({
    processInstanceId,
    phaseId: originPhaseId,
    proposalIds: origins.map((origin) => origin.id),
  });

  // The aggregates come back as one list for the loaded origins, so sorting
  // them here orders everything the table shows.
  const sorted = useMemo(() => sortOrigins(items, sort), [items, sort]);

  return (
    <ReviewSelectionTable
      items={sorted}
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

function sortOrigins(
  items: ProposalWithAggregates[],
  sort: OriginSort,
): ProposalWithAggregates[] {
  const byNewest = (a: ProposalWithAggregates, b: ProposalWithAggregates) =>
    (b.proposal.createdAt ?? '').localeCompare(a.proposal.createdAt ?? '');

  return [...items].sort((a, b) =>
    sort === 'score'
      ? b.aggregates.averageScore - a.aggregates.averageScore || byNewest(a, b)
      : byNewest(a, b),
  );
}
