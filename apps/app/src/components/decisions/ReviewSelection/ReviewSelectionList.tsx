'use client';

import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import { getRubricScoringInfo } from '@op/common/client';
import { EmptyState } from '@op/ui/EmptyState';
import { FooterBar } from '@op/ui/FooterBar';
import { Header3 } from '@op/ui/Header';
import { toast } from '@op/ui/Toast';
import { notFound } from 'next/navigation';
import { useMemo, useState } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '@/components/Bullet';

import { SelectionConfirmDialog } from '../SelectionConfirmDialog';
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

  const [{ items, total }] =
    trpc.decision.listWithReviewAggregates.useSuspenseQuery({
      processInstanceId,
      phaseId: previousPhaseId,
    });
  const utils = trpc.useUtils();

  const rubricTemplate = instance.instanceData?.rubricTemplate ?? null;
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
        />
      )}

      <FooterBar position="fixed" className="bg-neutral-offWhite/95">
        <FooterBar.Start>
          <span className="text-base text-neutral-black">
            {t('{count} proposals advancing', {
              count: advancingIds.length,
            })}
          </span>
        </FooterBar.Start>
        <FooterBar.Center />
        <FooterBar.End>
          <SelectionConfirmDialog
            isOpen={isConfirmOpen}
            onOpenChange={setIsConfirmOpen}
            proposals={selectedProposals}
            count={advancingIds.length}
            phaseName={currentPhaseName}
            triggerDisabled={advancingIds.length === 0}
            isSubmitting={submitMutation.isPending}
            onConfirm={() =>
              submitMutation.mutate({
                processInstanceId,
                proposalIds: advancingIds,
              })
            }
          />
        </FooterBar.End>
      </FooterBar>
    </div>
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
