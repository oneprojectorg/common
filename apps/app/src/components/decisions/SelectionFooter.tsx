'use client';

import type { Proposal } from '@op/common/client';
import {
  FooterBar,
  FooterBarCenter,
  FooterBarEnd,
  FooterBarStart,
} from '@op/sense/FooterBar';
import { cn } from '@op/sense/lib/utils';
import { useMemo } from 'react';
import { LuCircleCheck } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import {
  ComposeNotificationsDialog,
  type ConfirmResultsHandler,
} from './ComposeNotificationsDialog';
import { AwardBudgetMeter } from './selection/AwardBudgetMeter';
import type { ProposalAwards } from './useProposalAwards';

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
  awards?: ProposalAwards;
  processBudget?: number;
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
  awards,
  processBudget,
}: SelectionFooterProps) => {
  const t = useTranslations('decisions.review');
  const showMeter = awards !== undefined && processBudget !== undefined;
  const selectedIds = useMemo(
    () => selectedProposals.map((proposal) => proposal.id),
    [selectedProposals],
  );

  return (
    <FooterBar
      position="fixed"
      className={cn(
        'bg-muted/95',
        showMeter &&
          'max-md:*:flex-wrap max-md:*:gap-x-3 max-md:*:gap-y-2.5 max-md:*:px-4 max-md:*:py-3',
      )}
    >
      <FooterBarStart
        className={cn(showMeter && 'max-md:min-w-0 max-md:flex-1')}
      >
        <span className="flex items-center gap-2 text-base">
          <LuCircleCheck className="size-5 shrink-0" aria-hidden />
          {publishesResults
            ? t('winningProposalsSelectedCount', { count: numSelected })
            : t('proposalsSelectedCount', { count: numSelected })}
        </span>
      </FooterBarStart>
      <FooterBarCenter
        className={cn(
          showMeter ? 'max-md:order-3 max-md:basis-full' : 'max-md:hidden',
        )}
      >
        {showMeter ? (
          <AwardBudgetMeter
            awards={awards}
            selectedIds={selectedIds}
            processBudget={processBudget}
            className="max-w-xl"
          />
        ) : null}
      </FooterBarCenter>
      <FooterBarEnd>
        <ComposeNotificationsDialog
          selectedProposals={selectedProposals}
          selectedCount={numSelected}
          notSelectedCount={Math.max(totalCandidates - numSelected, 0)}
          awards={publishesResults && collectsBudget ? awards : undefined}
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
