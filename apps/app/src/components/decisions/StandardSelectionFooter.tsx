'use client';

import type { Proposal } from '@op/common/client';
import {
  FooterBar,
  FooterBarCenter,
  FooterBarEnd,
  FooterBarStart,
} from '@op/sense/FooterBar';
import { LuCircleCheck } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProposalMiniCard } from './ProposalCard';
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
    <FooterBar position="fixed" className="bg-muted/95">
      <FooterBarStart>
        <span className="flex items-center gap-2 text-base text-foreground">
          <LuCircleCheck className="size-5 shrink-0" aria-hidden />
          {t('{count} proposals selected', { count: numSelected })}
        </span>
      </FooterBarStart>
      <FooterBarCenter />
      <FooterBarEnd>
        <SelectionConfirmShell
          isOpen={isConfirmOpen}
          onOpenChange={onConfirmOpenChange}
          triggerDisabled={numSelected === 0}
          triggerLabel={t('Confirm selections')}
          headerLabel={t('Confirm advancing proposals')}
          confirmLabel={t('Publish')}
          isSubmitting={isSubmitting}
          onConfirm={onConfirm}
        >
          <div className="space-y-4">
            <p className="text-base text-foreground">
              {t(
                'These {numProposals} proposals will move on to the {phaseName} phase',
                { numProposals: numSelected, phaseName },
              )}
            </p>

            <div className="space-y-2">
              <div className="text-sm tracking-wider text-muted-foreground uppercase">
                {t('PROPOSALS TO ADVANCE')}
              </div>

              {selectedProposals.map((proposal) => (
                <ProposalMiniCard key={proposal.id} proposal={proposal} />
              ))}
            </div>
          </div>
        </SelectionConfirmShell>
      </FooterBarEnd>
    </FooterBar>
  );
};
