import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import type { ResultNotificationMessages } from '@op/common/client';
import { getRubricScoringInfo } from '@op/common/client';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Header3 } from '@op/sense/Header';
import { toast } from '@op/sense/Toast';
import { useMemo, useState } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { notFound } from '@/lib/navigation';

import { Bullet } from '@/components/Bullet';

import { FinalPhaseSelectionFooter } from '../FinalPhaseSelectionFooter';
import { StandardSelectionFooter } from '../StandardSelectionFooter';
import { useManualSelection } from '../useManualSelection';
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
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

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
      // The composer holds hand-written copy, so a retryable failure keeps it
      // open; the standard footer has nothing to preserve.
      if (!isFinalPhase) {
        setIsConfirmOpen(false);
      }
      toast.error(error.message);
    },
  });

  const handleConfirm = (resultNotifications?: ResultNotificationMessages) =>
    submitMutation.mutate({
      processInstanceId,
      // The resolved proposals, not the raw draft: the draft is persisted in
      // localStorage and can name rows that have since left the pool, which the
      // service rejects for the whole call.
      proposalIds: selectedProposals.map((proposal) => proposal.id),
      resultNotifications,
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
        />
      )}

      {isFinalPhase ? (
        <FinalPhaseSelectionFooter
          numSelected={selectedProposals.length}
          totalCandidates={items.length}
          isConfirmOpen={isConfirmOpen}
          onConfirmOpenChange={setIsConfirmOpen}
          onConfirm={handleConfirm}
          isSubmitting={submitMutation.isPending}
        />
      ) : (
        <StandardSelectionFooter
          selectedProposals={selectedProposals}
          numSelected={selectedProposals.length}
          phaseName={currentPhaseName}
          isConfirmOpen={isConfirmOpen}
          onConfirmOpenChange={setIsConfirmOpen}
          onConfirm={() => handleConfirm()}
          isSubmitting={submitMutation.isPending}
        />
      )}
    </div>
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
