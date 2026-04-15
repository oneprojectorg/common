'use client';

import { formatCurrency } from '@/utils/formatting';
import { trpc } from '@op/api/client';
import type { Proposal } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Chip } from '@op/ui/Chip';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { useLocale } from 'next-intl';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

interface ConfirmAdvanceProposalsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  proposals: Proposal[];
  budget?: number;
}

export function ConfirmAdvanceProposalsModal({
  isOpen,
  onOpenChange,
  instanceId,
  proposals,
  budget,
}: ConfirmAdvanceProposalsModalProps) {
  const t = useTranslations();
  const locale = useLocale();
  const utils = trpc.useUtils();
  const [isAdvancing, setIsAdvancing] = useState(false);

  const { data: preview } = trpc.decision.previewPhaseTransition.useQuery(
    { instanceId },
    { enabled: isOpen },
  );

  const advanceMutation = trpc.decision.transitionFromPhase.useMutation({
    onSuccess: () => {
      utils.decision.getInstance.invalidate({ instanceId });
      utils.decision.listProposals.invalidate();
      onOpenChange(false);
    },
    onSettled: () => {
      setIsAdvancing(false);
    },
  });

  const selectedIds = new Set(preview?.selectedProposalIds ?? []);
  const selectedProposals = proposals.filter((p) => selectedIds.has(p.id));

  const totalAllocated = selectedProposals.reduce((sum, p) => {
    const amount = p.proposalData?.budget?.amount;
    return sum + (typeof amount === 'number' ? amount : 0);
  }, 0);

  const remaining = budget != null ? budget - totalAllocated : undefined;
  const allocationPercentage =
    budget && budget > 0
      ? Math.min(100, Math.round((totalAllocated / budget) * 100))
      : 0;

  const handleConfirm = () => {
    setIsAdvancing(true);
    advanceMutation.mutate({
      instanceId,
      fromPhaseId: preview?.fromPhaseId,
    });
  };

  return (
    <Modal
      isDismissable={!isAdvancing}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!isAdvancing) {
          onOpenChange(open);
        }
      }}
    >
      <ModalHeader>{t('Confirm winning proposals')}</ModalHeader>
      <ModalBody className="gap-0 p-0">
        <div className="flex flex-col gap-2 px-6 py-4">
          <p className="text-sm text-neutral-charcoal">
            {t(
              'These {count} proposals will be funded and results will be shared with all participants.',
              { count: selectedProposals.length },
            )}
          </p>

          {budget != null && (
            <div className="flex flex-col gap-2 py-4">
              <div className="flex items-end justify-between font-serif text-sm tracking-tight text-neutral-black">
                <span>{t('Total Allocation')}</span>
                <span>{formatCurrency(budget, locale)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="relative h-1 w-full overflow-hidden rounded-full bg-neutral-gray2">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-functional-green to-primary-teal"
                    style={{ width: `${allocationPercentage}%` }}
                  />
                </div>
                {remaining != null && (
                  <span className="text-xs text-neutral-charcoal">
                    {formatCurrency(remaining, locale)} {t('remaining')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 px-6 pb-4">
          {selectedProposals.map((proposal) => (
            <ProposalRow
              key={proposal.id}
              proposal={proposal}
              locale={locale}
            />
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          color="primary"
          className="w-full"
          onPress={handleConfirm}
          isDisabled={isAdvancing || !preview}
        >
          {isAdvancing ? t('Advancing...') : t('Notify participants')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function ProposalRow({
  proposal,
  locale,
}: {
  proposal: Proposal;
  locale: string;
}) {
  const title = proposal.proposalData?.title ?? '';
  const budgetAmount = proposal.proposalData?.budget?.amount;
  const authorName = proposal.submittedBy?.name ?? proposal.profile?.name ?? '';
  const category = proposal.proposalData?.category;
  const categoryLabel = Array.isArray(category) ? category[0] : category;
  const voteCount = proposal.voteCount ?? proposal.likesCount ?? 0;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-gray1 bg-neutral-offWhite p-3">
      <div className="flex items-center justify-between gap-6">
        <span className="min-w-0 flex-1 truncate font-serif text-sm tracking-tight text-neutral-black">
          {title}
        </span>
        {budgetAmount != null && (
          <span className="shrink-0 font-serif text-sm tracking-tight text-neutral-charcoal">
            {formatCurrency(budgetAmount, locale)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-neutral-charcoal">
        {authorName && <span>{authorName}</span>}
        {categoryLabel && (
          <>
            <span className="text-neutral-gray4">&bull;</span>
            <Chip>{categoryLabel}</Chip>
          </>
        )}
        {voteCount > 0 && (
          <>
            <span className="text-neutral-gray4">&bull;</span>
            <span>{voteCount} votes</span>
          </>
        )}
      </div>
    </div>
  );
}
