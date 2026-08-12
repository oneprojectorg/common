'use client';

import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import {
  PROPOSAL_AGGREGATE_SORTS,
  type ProposalsWithReviewAggregatesList,
  getRubricScoringInfo,
} from '@op/common/client';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { toast } from '@op/ui/Toast';
import { notFound } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { SortDescriptor } from 'react-aria-components';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '@/components/Bullet';

import { StandardSelectionFooter } from '../StandardSelectionFooter';
import { useManualSelection } from '../useManualSelection';
import {
  ReviewSelectionTable,
  ReviewSelectionTableSkeleton,
} from './ReviewSelectionTable';

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
  const proposalsQuery = trpc.decision.listWithReviewAggregates.useQuery(
    {
      processInstanceId: instance.id,
      phaseId: previousPhaseId,
      orderBy,
      dir: sortDescriptor.direction === 'ascending' ? 'asc' : 'desc',
    },
    { placeholderData: (prev) => prev, throwOnError: true },
  );

  if (!decisionSlug) {
    notFound();
  }

  if (!proposalsQuery.data) {
    return <ReviewSelectionListSkeleton />;
  }

  return (
    <LoadedReviewSelectionList
      instance={instance}
      previousPhaseId={previousPhaseId}
      decisionSlug={decisionSlug}
      proposals={proposalsQuery.data}
      sortDescriptor={sortDescriptor}
      onSortChange={setSortDescriptor}
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
  proposals,
  sortDescriptor,
  onSortChange,
}: {
  instance: ProcessInstance;
  previousPhaseId: string;
  decisionSlug: string;
  proposals: ProposalsWithReviewAggregatesList;
  sortDescriptor: SortDescriptor;
  onSortChange: (descriptor: SortDescriptor) => void;
}) {
  const t = useTranslations();
  const processInstanceId = instance.id;
  const { items, total, rubricTemplate } = proposals;

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

  const selectedProposals = useMemo(
    () =>
      items
        .filter((item) => advancing.has(item.proposal.id))
        .map((item) => item.proposal),
    [items, advancing],
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
