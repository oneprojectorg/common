'use client';

import { formatDate } from '@/utils/formatting';
import { Alert, AlertDescription } from '@op/sense/Alert';
import { useLocale } from 'next-intl';
import { LuLock } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n/routing';

interface HiddenProposalsBannerProps {
  nextPhaseName?: string;
  currentPhaseEndDate?: string;
}

export function HiddenProposalsBanner({
  nextPhaseName,
  currentPhaseEndDate,
}: HiddenProposalsBannerProps) {
  const t = useTranslations('decisions.proposals');
  const locale = useLocale();

  const formattedDate = currentPhaseEndDate
    ? formatDate(currentPhaseEndDate, locale, {
        month: 'short',
        day: 'numeric',
      })
    : undefined;

  const message =
    nextPhaseName && formattedDate
      ? t('privateProposalsWithDateNotice', {
          nextPhase: nextPhaseName,
          date: formattedDate,
        })
      : t('privateProposalsNotice');

  return (
    <Alert
      variant="warning"
      className="rounded-none border-x-0 border-t-0 border-b-border"
      role="status"
      aria-live="polite"
    >
      <LuLock className="size-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
