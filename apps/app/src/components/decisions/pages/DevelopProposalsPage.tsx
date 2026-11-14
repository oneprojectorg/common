'use client';

import { useTranslations } from '@/lib/i18n';

import { DecisionHero } from '../DecisionHero';

/**
 * Placeholder for the develop screen: what someone with develop access sees
 * while a develop phase is current and its inbound selection is still
 * pending. Intentionally empty until the entry editor lands.
 */
export function DevelopProposalsPage() {
  const t = useTranslations('decisions');

  return (
    <div className="min-h-full pt-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 px-4 pb-8">
        <DecisionHero
          title={t('developEntriesHeading')}
          description={<p>{t('developEntriesPlaceholder')}</p>}
          showTranslateLink={false}
        />
      </div>
    </div>
  );
}
