'use client';

import { AlertBanner } from '@op/ui/AlertBanner';
import { formatPhaseDate } from '@op/ui/utils/formatting';
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
  const t = useTranslations();
  const locale = useLocale();

  const formattedDate = currentPhaseEndDate
    ? formatPhaseDate(
        currentPhaseEndDate,
        { month: 'short', day: 'numeric' },
        locale,
      )
    : undefined;

  const message =
    nextPhaseName && formattedDate
      ? t(
          'Proposals are private during this phase. All proposals will move to {nextPhase} on {date}.',
          { nextPhase: nextPhaseName, date: formattedDate },
        )
      : t('Proposals are private during this phase.');

  return (
    <AlertBanner
      variant="banner"
      intent="warning"
      fullWidth
      icon={<LuLock className="size-4" />}
      className="border-t-0 border-b-neutral-gray1"
      role="status"
      aria-live="polite"
    >
      {message}
    </AlertBanner>
  );
}
