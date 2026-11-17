'use client';

import type { InstancePhaseData } from '@op/api/encoders';
import { Header1 } from '@op/sense/Header';
import type { ReactNode } from 'react';

import { type TranslateFn, useTranslations } from '@/lib/i18n';

/**
 * The frame every develop screen shares while a develop phase is current and
 * its inbound selection is still pending: a muted band that names the task,
 * and the page column below it for the screen's own body.
 */
export function DevelopPageShell({ children }: { children: ReactNode }) {
  const t = useTranslations('decisions');

  return (
    <div className="min-h-full">
      <section className="bg-muted px-4 pt-8 pb-7 text-center">
        <div className="mx-auto flex max-w-page flex-col items-center gap-3">
          <Header1 className="text-primary">{t('develop.heroTitle')}</Header1>
          <p className="max-w-prose text-base text-balance text-foreground">
            {t('selectAdvancingHeading')}
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-page px-4 pt-12 pb-32">
        {children}
      </div>
    </div>
  );
}

/**
 * The name shown for the develop phase's developed proposals. The default
 * stands until the phase's form schema supplies a name.
 */
export function getEntryName({
  t,
}: {
  developPhase: InstancePhaseData | undefined;
  t: TranslateFn<'decisions'>;
}): string {
  return t('develop.defaultEntryName');
}
