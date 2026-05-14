'use client';

import type { Proposal } from '@op/common/client';
import { FooterBar } from '@op/ui/FooterBar';

import { useTranslations } from '@/lib/i18n';

import {
  ProposalCard,
  ProposalCardCategory,
  ProposalCardContent,
  ProposalCardHeader,
} from './ProposalCard';
import { SelectionConfirmShell } from './SelectionConfirmShell';

interface StandardSelectionFooterProps {
  selectedProposals: Proposal[];
  numSelected: number;
  phaseName: string;
  isConfirmOpen: boolean;
  onConfirmOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export const StandardSelectionFooter = ({
  selectedProposals,
  numSelected,
  phaseName,
  isConfirmOpen,
  onConfirmOpenChange,
  onConfirm,
  isSubmitting,
}: StandardSelectionFooterProps) => {
  const t = useTranslations();

  return (
    <FooterBar position="fixed" className="bg-neutral-offWhite/95">
      <FooterBar.Start>
        <span className="text-base text-neutral-black">
          {t('{count} proposals advancing', { count: numSelected })}
        </span>
      </FooterBar.Start>
      <FooterBar.Center />
      <FooterBar.End>
        <SelectionConfirmShell
          isOpen={isConfirmOpen}
          onOpenChange={onConfirmOpenChange}
          triggerDisabled={numSelected === 0}
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
                { numProposals: numSelected, phaseName },
              )}
            </p>

            <div className="space-y-2">
              <div className="text-sm tracking-wider text-neutral-gray4 uppercase">
                {t('PROPOSALS TO ADVANCE')}
              </div>

              {selectedProposals.map((proposal) => (
                <ProposalCard
                  className="bg-neutral-offWhite p-3"
                  key={proposal.id}
                >
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
      </FooterBar.End>
    </FooterBar>
  );
};
