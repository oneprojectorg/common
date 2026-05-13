'use client';

import type { Proposal } from '@op/common/client';
import { FooterBar } from '@op/ui/FooterBar';

import { useTranslations } from '@/lib/i18n';

import { FinalPhaseSelectionConfirmDialog } from './FinalPhaseSelectionConfirmDialog';

interface FinalPhaseSelectionFooterProps {
  selectedProposals: Proposal[];
  numSelected: number;
  isConfirmOpen: boolean;
  onConfirmOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export const FinalPhaseSelectionFooter = ({
  selectedProposals,
  numSelected,
  isConfirmOpen,
  onConfirmOpenChange,
  onConfirm,
  isSubmitting,
}: FinalPhaseSelectionFooterProps) => {
  const t = useTranslations();

  return (
    <FooterBar position="fixed" className="bg-neutral-offWhite/95">
      <FooterBar.Start>
        <span className="text-base text-neutral-black">
          {t('{count} winning proposals selected', { count: numSelected })}
        </span>
      </FooterBar.Start>
      <FooterBar.Center />
      <FooterBar.End>
        <FinalPhaseSelectionConfirmDialog
          isOpen={isConfirmOpen}
          onOpenChange={onConfirmOpenChange}
          proposals={selectedProposals}
          count={numSelected}
          triggerDisabled={numSelected === 0}
          isSubmitting={isSubmitting}
          onConfirm={onConfirm}
        />
      </FooterBar.End>
    </FooterBar>
  );
};
