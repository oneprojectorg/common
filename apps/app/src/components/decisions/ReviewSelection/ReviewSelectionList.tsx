'use client';

import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import type {
  ProposalAllocation,
  ResultNotificationMessages,
} from '@op/common/client';
import { getProcessBudget, getRubricScoringInfo } from '@op/common/client';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Header3 } from '@op/sense/Header';
import { toast } from '@op/sense/Toast';
import { notFound } from 'next/navigation';
import { useMemo, useState } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '@/components/Bullet';
import { getTemplateCurrency } from '@/components/decisions/proposalTemplate';

import { ProposalCardDialogProvider } from '../ProposalCardDialogContext';
import { SelectionFooter } from '../SelectionFooter';
import { useManualAwardDraft } from '../useManualAwardDraft';
import { useManualSelection } from '../useManualSelection';
import { useProposalAwards } from '../useProposalAwards';
import {
  ReviewSelectionTable,
  ReviewSelectionTableSkeleton,
} from './ReviewSelectionTable';

export function ReviewSelectionList({
  instance,
  previousPhaseId,
  showBudget,
  isFinalPhase,
}: {
  instance: ProcessInstance;
  /** Phase whose proposals + review aggregates we're shortlisting from. */
  previousPhaseId: string;
  /** Show the budget column. Derived by the page so the skeleton agrees. */
  showBudget: boolean;
  /**
   * Confirming publishes results instead of advancing anyone, so the admin
   * composes the copy mailed to every author first. Derived by the page,
   * which words its hero off the same answer.
   *
   * Named to match `ManualSelectionList`'s `confirmVariant === 'finalPhase'`;
   * the service calls the same predicate `publishesResults`.
   */
  isFinalPhase: boolean;
}) {
  const t = useTranslations();
  const processInstanceId = instance.id;
  const decisionSlug = instance.slug;

  if (!decisionSlug) {
    notFound();
  }

  // Persisted in localStorage so selection survives navigation to the
  // per-proposal review summary and back.
  const [advancingIds, setAdvancingIds] = useManualSelection(
    processInstanceId,
    previousPhaseId,
  );
  const advancing = useMemo(() => new Set(advancingIds), [advancingIds]);
  const awardDraft = useManualAwardDraft(processInstanceId, previousPhaseId);
  const [, setAwardDraft] = awardDraft;
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const awardsAmounts = isFinalPhase && showBudget;
  const processBudget = getProcessBudget({
    phases: instance.instanceData?.phases,
    currentPhaseId: instance.currentStateId,
  });

  const [{ items, rubricTemplate }] =
    trpc.decision.listWithReviewAggregates.useSuspenseQuery({
      processInstanceId,
      phaseId: previousPhaseId,
    });
  const utils = trpc.useUtils();

  const { totalPoints, hasScoring } = useMemo(() => {
    if (!rubricTemplate) {
      return { totalPoints: 0, hasScoring: false };
    }
    const info = getRubricScoringInfo(rubricTemplate);
    return {
      totalPoints: info.totalPoints,
      hasScoring: info.criteria.some((c) => c.scored),
    };
  }, [rubricTemplate]);

  const selectedProposals = useMemo(
    () =>
      items
        .filter((item) => advancing.has(item.proposal.id))
        .map((item) => item.proposal),
    [items, advancing],
  );
  const proposals = useMemo(() => items.map((item) => item.proposal), [items]);
  const selectedIds = useMemo(
    () => selectedProposals.map((proposal) => proposal.id),
    [selectedProposals],
  );
  const awards = useProposalAwards({
    proposals,
    selectedIds,
    isEnabled: awardsAmounts,
    processBudget,
    draft: awardDraft,
    fallbackCurrency: getTemplateCurrency(
      instance.instanceData?.proposalTemplate,
    ),
  });

  const currentPhaseName =
    instance.instanceData?.phases?.find(
      (p) => p.phaseId === instance.currentStateId,
    )?.name ?? '';

  const submitMutation = trpc.decision.submitManualSelection.useMutation({
    onSuccess: () => {
      utils.decision.getInstance.invalidate({ instanceId: processInstanceId });
      setAdvancingIds([]);
      setAwardDraft({});
      setIsConfirmOpen(false);
    },
    onError: (error) => {
      // Re-read rather than sorting the failure by error code. If this lost to
      // a concurrent advance or an already-submitted selection, the instance
      // refetch flips `selectionsAreConfirmed` and routes this screen away; if
      // a proposal left the pool, the aggregates refetch drops it from
      // `selectedProposals`. Either way the retry isn't doomed to repeat.
      utils.decision.getInstance.invalidate({ instanceId: processInstanceId });
      utils.decision.listWithReviewAggregates.invalidate({
        processInstanceId,
        phaseId: previousPhaseId,
      });
      toast.error(error.message);
    },
  });

  const handleConfirm = (
    resultNotifications?: ResultNotificationMessages,
    allocations?: ProposalAllocation[],
  ) =>
    submitMutation.mutate({
      processInstanceId,
      // The resolved proposals, not the raw draft: the draft is persisted in
      // localStorage and can name rows that have since left the pool, which the
      // service rejects for the whole call.
      proposalIds: selectedProposals.map((proposal) => proposal.id),
      resultNotifications,
      allocations,
    });

  const handleAdvanceToggle = (proposalId: string) => {
    setAdvancingIds(
      advancing.has(proposalId)
        ? advancingIds.filter((id) => id !== proposalId)
        : [...advancingIds, proposalId],
    );
  };

  return (
    <ProposalCardDialogProvider mergePhaseId={previousPhaseId}>
      <div className="flex flex-col gap-6 pb-20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Header3 className="flex items-center gap-2">
            {t('decisions.proposals.allProposalsOption')}
            <Bullet />
            {items.length}
          </Header3>
        </div>

        {items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LuLeaf className="size-6" />
              </EmptyMedia>
              <EmptyTitle render={<h3 />}>
                {t('decisions.review.noProposalsToReview')}
              </EmptyTitle>
              <EmptyDescription>
                {t('decisions.review.noProposalsSubmittedHint')}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ReviewSelectionTable
            items={items}
            totalPoints={totalPoints}
            showScore={hasScoring}
            onAdvance={handleAdvanceToggle}
            advancingIds={advancing}
            decisionSlug={decisionSlug}
            showBudget={showBudget}
            awards={awardsAmounts ? awards : undefined}
          />
        )}

        <SelectionFooter
          selectedProposals={selectedProposals}
          numSelected={selectedProposals.length}
          totalCandidates={items.length}
          publishesResults={isFinalPhase}
          phaseName={currentPhaseName}
          collectsBudget={showBudget}
          isConfirmOpen={isConfirmOpen}
          onConfirmOpenChange={setIsConfirmOpen}
          onConfirm={handleConfirm}
          isSubmitting={submitMutation.isPending}
          awards={awardsAmounts ? awards : undefined}
          processBudget={processBudget}
        />
      </div>
    </ProposalCardDialogProvider>
  );
}

export function ReviewSelectionListSkeleton({
  showScore = true,
  showBudget = true,
}: {
  showScore?: boolean;
  showBudget?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-8 w-32 animate-pulse rounded bg-secondary" />
      <ReviewSelectionTableSkeleton
        showScore={showScore}
        showBudget={showBudget}
      />
    </div>
  );
}
