'use client';

import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import { getRubricScoringInfo } from '@op/common/client';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { toast } from '@op/sense/Toast';
import { notFound } from 'next/navigation';
import { useMemo, useState } from 'react';
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

  const [{ items, total, rubricTemplate }] =
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
      setIsConfirmOpen(false);
      toast.error(error.message);
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
          <span className="font-serif text-title font-light">
            {t('All proposals')}
          </span>
          <Bullet />
          <span className="font-serif text-title font-light">{total}</span>
        </div>
      </div>

      {items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LuLeaf className="size-6" />
            </EmptyMedia>
            <EmptyTitle render={<h3 />}>
              {t('No proposals to review yet')}
            </EmptyTitle>
            <EmptyDescription>
              {t('Proposals will appear here once they are submitted.')}
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

export function ReviewSelectionListSkeleton({
  showScore = true,
}: {
  showScore?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-8 w-32 animate-pulse rounded bg-secondary" />
      <ReviewSelectionTableSkeleton showScore={showScore} />
    </div>
  );
}
