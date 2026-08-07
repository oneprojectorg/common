'use client';

import { posthogUIHost } from '@op/core';
import { Button } from '@op/sense/Button';
import { Header1 } from '@op/sense/Header';
import { LuArrowUpRight } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

/** Platform admin header with title and action buttons */
export const PlatformAdminHeader = () => {
  const t = useTranslations();

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-1">
        <Header1 className="text-headline text-foreground">
          {t('Platform admin')}
        </Header1>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => {
          window.open(posthogUIHost, '_blank');
        }}
      >
        <LuArrowUpRight className="size-4" />
        {t('View all analytics')}
      </Button>
    </div>
  );
};
