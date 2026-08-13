'use client';

import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import {
  PROPOSAL_AGGREGATE_SORTS,
  type ProposalWithAggregates,
  type ProposalsWithReviewAggregatesList,
  getRubricScoringInfo,
} from '@op/common/client';
import { useInfiniteScroll } from '@op/hooks';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import type { SortDescriptor } from '@op/ui/RAC';
import { SkeletonLine } from '@op/ui/Skeleton';
import { toast } from '@op/ui/Toast';
import { notFound } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '@/components/Bullet';

import { StandardSelectionFooter } from '../StandardSelectionFooter';
import { useManualSelection } from '../useManualSelection';
import {
  ReviewSelectionTable,
  ReviewSelectionTableSkeleton,
} from './ReviewSelectionTable';

const PROPOSALS_PER_PAGE = 25;

export function ReviewSelectionList({
  instance,
  previousPhaseId,
}: {
  instance: ProcessInstance;
  /** Phase whose proposals + review aggregates we're shortlisting from. */
  previousPhaseId: string;
}) {
  const decisionSlug = instance.slug;

  // No column is sorted initially: `createdAt` isn't a table column, so the
  // list opens in the server's newest-first order with no header indicator.
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'createdAt',
    direction: 'descending',
  });
  const orderBy =
    PROPOSAL_AGGREGATE_SORTS.find(
      (column) => column === sortDescriptor.column,
    ) ?? 'createdAt';

  // Non-suspense + placeholderData so a header click re-sorts without blanking
  // the table while the server re-fetches (same pattern as ManualSelectionList).
  // `throwOnError` keeps failures going to the page's APIErrorBoundary, which is
  // where they landed while this was a suspense query.
  const proposalsQuery =
    trpc.decision.listWithReviewAggregates.useInfiniteQuery(
      {
        processInstanceId: instance.id,
        phaseId: previousPhaseId,
        limit: PROPOSALS_PER_PAGE,
        orderBy,
        dir: sortDescriptor.direction === 'ascending' ? 'asc' : 'desc',
      },
      {
        getNextPageParam: (lastPage) => lastPage.next,
        placeholderData: (prev) => prev,
        throwOnError: true,
      },
    );

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = proposalsQuery;
  const { ref: scrollTriggerRef, shouldShowTrigger } = useInfiniteScroll(
    fetchNextPage,
    { hasNextPage, isFetchingNextPage },
  );

  const pages = proposalsQuery.data?.pages;
  // Stable across renders so the selection cache downstream only rebuilds when
  // a page actually arrives.
  const items = useMemo(
    () => pages?.flatMap((page) => page.items) ?? [],
    [pages],
  );

  if (!decisionSlug) {
    notFound();
  }

  if (!pages) {
    return <ReviewSelectionListSkeleton />;
  }

  return (
    <LoadedReviewSelectionList
      instance={instance}
      previousPhaseId={previousPhaseId}
      decisionSlug={decisionSlug}
      items={items}
      total={pages[0]?.total ?? 0}
      rubricTemplate={pages[0]?.rubricTemplate ?? null}
      sortDescriptor={sortDescriptor}
      onSortChange={setSortDescriptor}
      scrollTrigger={
        shouldShowTrigger ? (
          <div ref={scrollTriggerRef} className="flex justify-center py-4">
            {isFetchingNextPage ? <SkeletonLine lines={3} /> : null}
          </div>
        ) : null
      }
    />
  );
}

export function ReviewSelectionListSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-8 w-32 animate-pulse rounded bg-neutral-gray1" />
      <ReviewSelectionTableSkeleton />
    </div>
  );
}

/** The shortlisting UI itself, once the proposals for the phase are in. */
function LoadedReviewSelectionList({
  instance,
  previousPhaseId,
  decisionSlug,
  items,
  total,
  rubricTemplate,
  sortDescriptor,
  onSortChange,
  scrollTrigger,
}: {
  instance: ProcessInstance;
  previousPhaseId: string;
  decisionSlug: string;
  items: ProposalWithAggregates[];
  total: number;
  rubricTemplate: ProposalsWithReviewAggregatesList['rubricTemplate'];
  sortDescriptor: SortDescriptor;
  onSortChange: (descriptor: SortDescriptor) => void;
  /** Sentinel that pulls the next page into view; null on the last page. */
  scrollTrigger: ReactNode;
}) {
  const t = useTranslations();
  const processInstanceId = instance.id;

  // Persisted in localStorage so selection survives navigation to the
  // per-proposal review summary and back.
  const [advancingIds, setAdvancingIds] = useManualSelection(
    processInstanceId,
    previousPhaseId,
  );
  const advancing = useMemo(() => new Set(advancingIds), [advancingIds]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const utils = trpc.useUtils();

  const totalPoints = useMemo(
    () =>
      rubricTemplate ? getRubricScoringInfo(rubricTemplate).totalPoints : 0,
    [rubricTemplate],
  );

  // Resolve selected ids → proposals via a cache that accumulates across pages,
  // so the confirm dialog still names a pick made on a page that a re-sort has
  // since dropped (same reason ManualSelectionList keeps one).
  const [proposalCache, setProposalCache] = useState<
    Record<string, ProposalWithAggregates['proposal']>
  >({});
  useEffect(() => {
    setProposalCache((prev) => {
      const next = { ...prev };
      for (const item of items) {
        next[item.proposal.id] = item.proposal;
      }
      return next;
    });
  }, [items]);

  const selectedProposals = useMemo(
    () =>
      advancingIds
        .map((id) => proposalCache[id])
        .filter((proposal) => proposal !== undefined),
    [advancingIds, proposalCache],
  );

  const currentPhaseName =
    instance.instanceData?.phases?.find(
      (p) => p.phaseId === instance.currentStateId,
    )?.name ?? '';

  const submitMutation = trpc.decision.submitManualSelection.useMutation({
    onSuccess: () => {
      utils.decision.getInstance.invalidate({ instanceId: processInstanceId });
      setAdvancingIds([]);
      setIsConfirmOpen(false);
    },
    onError: (error) => {
      setIsConfirmOpen(false);
      toast.error({ message: error.message });
    },
  });

  const handleAdvanceToggle = (proposalId: string) => {
    setAdvancingIds(
      advancing.has(proposalId)
        ? advancingIds.filter((id) => id !== proposalId)
        : [...advancingIds, proposalId],
    );
  };

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-serif text-title-base text-neutral-black">
            {t('All proposals')}
          </span>
          <Bullet />
          <span className="font-serif text-title-base text-neutral-black">
            {total}
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<LuLeaf className="size-6" />}>
          <Header3 className="font-serif font-light">
            {t('No proposals to review yet')}
          </Header3>
          <p className="text-base text-neutral-charcoal">
            {t('Proposals will appear here once they are submitted.')}
          </p>
        </EmptyState>
      ) : (
        <ReviewSelectionTable
          items={items}
          totalPoints={totalPoints}
          onAdvance={handleAdvanceToggle}
          advancingIds={advancing}
          decisionSlug={decisionSlug}
          sortDescriptor={sortDescriptor}
          onSortChange={onSortChange}
        />
      )}

      {scrollTrigger}

      <StandardSelectionFooter
        selectedProposals={selectedProposals}
        numSelected={advancingIds.length}
        phaseName={currentPhaseName}
        isConfirmOpen={isConfirmOpen}
        onConfirmOpenChange={setIsConfirmOpen}
        onConfirm={() =>
          submitMutation.mutate({
            processInstanceId,
            proposalIds: advancingIds,
          })
        }
        isSubmitting={submitMutation.isPending}
      />
    </div>
  );
}
