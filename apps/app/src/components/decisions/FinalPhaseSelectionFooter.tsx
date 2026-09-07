'use client';

import type { ResultNotificationMessages } from '@op/common/client';
import {
  FooterBar,
  FooterBarCenter,
  FooterBarEnd,
  FooterBarStart,
} from '@op/sense/FooterBar';
import { LuCircleCheck } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ComposeNotificationsDialog } from './ComposeNotificationsDialog';

interface FinalPhaseSelectionFooterProps {
  numSelected: number;
  /** Every eligible proposal in the phase, selected or not. */
  totalCandidates: number;
  isConfirmOpen: boolean;
  onConfirmOpenChange: (open: boolean) => void;
  onConfirm: (messages: ResultNotificationMessages) => void;
  isSubmitting: boolean;
}

export const FinalPhaseSelectionFooter = ({
  numSelected,
  totalCandidates,
  isConfirmOpen,
  onConfirmOpenChange,
  onConfirm,
  isSubmitting,
}: FinalPhaseSelectionFooterProps) => {
  const t = useTranslations();

  return (
    <FooterBar position="fixed" className="bg-muted/95">
      <FooterBarStart>
        <span className="flex items-center gap-2 text-base">
          <LuCircleCheck className="size-5 shrink-0" aria-hidden />
          {/* Keeps "winning": this footer drives the irreversible final-phase
              publish, and Figma has no frame for this variant. */}
          {t('{count} winning proposals selected', { count: numSelected })}
        </span>
      </FooterBarStart>
      <FooterBarCenter />
      <FooterBarEnd>
        <ComposeNotificationsDialog
          fundedCount={numSelected}
          // Selections are drawn from the candidate pool, so this can't go
          // negative — but a stale count under an open dialog shouldn't be
          // able to render "-1 recipients" either.
          notFundedCount={Math.max(totalCandidates - numSelected, 0)}
          isOpen={isConfirmOpen}
          onOpenChange={onConfirmOpenChange}
          onConfirm={onConfirm}
          isSubmitting={isSubmitting}
          triggerLabel={
            <>
              <span className="sm:hidden">{t('Confirm')}</span>
              <span className="hidden sm:inline">
                {t('Confirm winning proposals')}
              </span>
            </>
          }
        />
      </FooterBarEnd>
    </FooterBar>
  );
};
