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

import {
  ComposeNotificationsDialog,
  type ConfirmResultsHandler,
} from './ComposeNotificationsDialog';

interface FinalPhaseSelectionFooterProps {
  selectedProposals: Proposal[];
  numSelected: number;
  totalCandidates: number;
  /** The template collects a budget, so winners are awarded an amount. */
  awardsAmounts: boolean;
  isConfirmOpen: boolean;
  onConfirmOpenChange: (open: boolean) => void;
  onConfirm: ConfirmResultsHandler;
  isSubmitting: boolean;
}

export const FinalPhaseSelectionFooter = ({
  selectedProposals,
  numSelected,
  totalCandidates,
  awardsAmounts,
  isConfirmOpen,
  onConfirmOpenChange,
  onConfirm,
  isSubmitting,
}: FinalPhaseSelectionFooterProps) => {
  const t = useTranslations('decisions.review');

  return (
    <FooterBar position="fixed" className="bg-muted/95">
      <FooterBarStart>
        <span className="flex items-center gap-2 text-base">
          <LuCircleCheck className="size-5 shrink-0" aria-hidden />
          {/* Keeps "winning": this footer drives the irreversible final-phase
              publish, and Figma has no frame for this variant. */}
          {t('winningProposalsSelectedCount', { count: numSelected })}
        </span>
      </FooterBarStart>
      <FooterBarCenter />
      <FooterBarEnd>
        <ComposeNotificationsDialog
          selectedProposals={selectedProposals}
          selectedCount={numSelected}
          notSelectedCount={Math.max(totalCandidates - numSelected, 0)}
          awardsAmounts={awardsAmounts}
          isOpen={isConfirmOpen}
          onOpenChange={onConfirmOpenChange}
          onConfirm={onConfirm}
          isSubmitting={isSubmitting}
          triggerLabel={
            <>
              <span className="sm:hidden">{t('confirmAction')}</span>
              <span className="hidden sm:inline">
                {t('confirmWinningProposalsTitle')}
              </span>
            </>
          }
        />
      </FooterBarEnd>
    </FooterBar>
  );
};
