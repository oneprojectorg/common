'use client';

import type { Proposal } from '@op/common/client';

import { useTranslations } from '@/lib/i18n';

import {
  ProposalCard,
  ProposalCardCategory,
  ProposalCardContent,
  ProposalCardHeader,
} from './ProposalCard';
import { SelectionConfirmShell } from './SelectionConfirmShell';

interface SelectionConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  proposals: Proposal[];
  count: number;
  phaseName: string;
  onConfirm: () => void;
  isSubmitting: boolean;
  triggerDisabled: boolean;
}

/**
 * Standard "advance to next phase" confirm dialog. Lists the proposals being
 * advanced and announces the next phase. The final-phase / funded-results
 * variant lives in {@link FinalPhaseSelectionConfirmDialog}.
 */
export const SelectionConfirmDialog = ({
  isOpen,
  onOpenChange,
  proposals,
  count,
  phaseName,
  onConfirm,
  isSubmitting,
  triggerDisabled,
}: SelectionConfirmDialogProps) => {
  const t = useTranslations();

  return (
    <SelectionConfirmShell
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      triggerDisabled={triggerDisabled}
      triggerLabel={t('Confirm decisions')}
      headerLabel={t('Confirm advancing proposals')}
      confirmLabel={t('Publish')}
      isSubmitting={isSubmitting}
      onConfirm={onConfirm}
    >
      <div className="space-y-4">
        <p className="text-base text-neutral-charcoal">
          {t(
            'These {numProposals} proposals will move on to the {phaseName} phase',
            { numProposals: count, phaseName },
          )}
        </p>

        <div className="space-y-2">
          <div className="text-sm tracking-wider text-neutral-gray4 uppercase">
            {t('PROPOSALS TO ADVANCE')}
          </div>

          {proposals.map((proposal) => (
            <ProposalCard className="bg-neutral-offWhite p-3" key={proposal.id}>
              <ProposalCardContent>
                <ProposalCardHeader
                  className="flex-row flex-wrap justify-between"
                  proposal={proposal}
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-charcoal">
                    {proposal.submittedBy?.name}
                  </span>
                  <ProposalCardCategory proposal={proposal} />
                </div>
              </ProposalCardContent>
            </ProposalCard>
          ))}
        </div>
      </div>
    </SelectionConfirmShell>
  );
};
