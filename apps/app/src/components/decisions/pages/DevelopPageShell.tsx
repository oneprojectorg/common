'use client';

import { Header1 } from '@op/sense/Header';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

interface DevelopPageShellProps {
  children: ReactNode;
  /** Hero heading. Omit for the develop screen's heading. */
  title?: string;
  /** Hero text under the heading. Omit for the develop screen's text. */
  description?: string;
  /** Controls under the hero text. */
  heroActions?: ReactNode;
}

export function DevelopPageShell({
  children,
  title,
  description,
  heroActions,
}: DevelopPageShellProps) {
  const t = useTranslations('decisions');

  return (
    <div className="min-h-full">
      <section className="bg-muted px-4 pt-8 pb-7 text-center">
        <div className="mx-auto flex max-w-page flex-col items-center gap-3">
          <Header1 className="text-primary">
            {title ?? t('develop.heroTitle')}
          </Header1>
          <p className="max-w-prose text-base text-balance text-foreground">
            {description ?? t('selectAdvancingHeading')}
          </p>
          {heroActions}
        </div>
      </section>

      <div className="mx-auto w-full max-w-page px-4 pt-12 pb-32 sm:px-8">
        {children}
      </div>
    </div>
  );
}
