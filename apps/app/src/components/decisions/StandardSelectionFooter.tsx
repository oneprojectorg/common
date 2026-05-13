'use client';

import type { Proposal } from '@op/common/client';
import { FooterBar } from '@op/ui/FooterBar';

import { useTranslations } from '@/lib/i18n';

import { SelectionConfirmDialog } from './SelectionConfirmDialog';

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
        <SelectionConfirmDialog
          isOpen={isConfirmOpen}
          onOpenChange={onConfirmOpenChange}
          proposals={selectedProposals}
          count={numSelected}
          phaseName={phaseName}
          triggerDisabled={numSelected === 0}
          isSubmitting={isSubmitting}
          onConfirm={onConfirm}
        />
      </FooterBar.End>
    </FooterBar>
  );
};
