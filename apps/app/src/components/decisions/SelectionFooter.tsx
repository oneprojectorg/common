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

interface SelectionFooterProps {
  selectedProposals: Proposal[];
  numSelected: number;
  totalCandidates: number;
  publishesResults: boolean;
  phaseName: string;
  collectsBudget: boolean;
  isConfirmOpen: boolean;
  onConfirmOpenChange: (open: boolean) => void;
  onConfirm: ConfirmResultsHandler;
  isSubmitting: boolean;
}

export const SelectionFooter = ({
  selectedProposals,
  numSelected,
  totalCandidates,
  publishesResults,
  phaseName,
  collectsBudget,
  isConfirmOpen,
  onConfirmOpenChange,
  onConfirm,
  isSubmitting,
}: SelectionFooterProps) => {
  const t = useTranslations('decisions.review');

  return (
    <FooterBar position="fixed" className="bg-muted/95">
      <FooterBarStart>
        <span className="flex items-center gap-2 text-base">
          <LuCircleCheck className="size-5 shrink-0" aria-hidden />
          {publishesResults
            ? t('winningProposalsSelectedCount', { count: numSelected })
            : t('proposalsSelectedCount', { count: numSelected })}
        </span>
      </FooterBarStart>
      <FooterBarCenter />
      <FooterBarEnd>
        <ComposeNotificationsDialog
          selectedProposals={selectedProposals}
          selectedCount={numSelected}
          notSelectedCount={Math.max(totalCandidates - numSelected, 0)}
          awardsAmounts={publishesResults && collectsBudget}
          phaseName={phaseName}
          isOpen={isConfirmOpen}
          onOpenChange={onConfirmOpenChange}
          onConfirm={onConfirm}
          isSubmitting={isSubmitting}
          triggerLabel={
            publishesResults ? (
              <>
                <span className="sm:hidden">{t('confirmAction')}</span>
                <span className="hidden sm:inline">
                  {t('confirmWinningProposalsTitle')}
                </span>
              </>
            ) : (
              t('confirmSelectionsAction')
            )
          }
        />
      </FooterBarEnd>
    </FooterBar>
  );
};
