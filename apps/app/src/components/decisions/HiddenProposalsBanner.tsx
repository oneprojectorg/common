'use client';

import { AlertBanner } from '@op/ui/AlertBanner';
import { useLocale } from 'next-intl';
import { LuLock } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n/routing';

interface HiddenProposalsBannerProps {
  nextPhaseName?: string;
  nextPhaseStartDate?: string;
}

export function HiddenProposalsBanner({
  nextPhaseName,
  nextPhaseStartDate,
}: HiddenProposalsBannerProps) {
  const t = useTranslations();
  const locale = useLocale();

  const formattedDate = nextPhaseStartDate
    ? new Date(nextPhaseStartDate).toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
      })
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
      intent="default"
      fullWidth
      icon={<LuLock className="size-4" />}
    >
      {message}
    </AlertBanner>
  );
}
