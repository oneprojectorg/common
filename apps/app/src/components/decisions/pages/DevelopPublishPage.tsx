'use client';

import { useTranslations } from '@/lib/i18n';

import { DecisionHero } from '../DecisionHero';

/**
 * Placeholder for the publish screen: what an admin sees while a develop
 * phase is current and its inbound selection is still pending. Intentionally
 * empty until the publish flow lands.
 */
export function DevelopPublishPage() {
  const t = useTranslations('decisions');

  return (
    <div className="min-h-full pt-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 px-4 pb-8">
        <DecisionHero
          title={t('publishEntriesHeading')}
          description={<p>{t('publishEntriesPlaceholder')}</p>}
          showTranslateLink={false}
        />
      </div>
    </div>
  );
}
