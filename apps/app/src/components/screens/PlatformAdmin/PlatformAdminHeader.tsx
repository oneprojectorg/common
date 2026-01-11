'use client';

import { posthogUIHost } from '@op/core';
import { Button } from '@op/ui/Button';
import { LuArrowUpRight } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

/** Platform admin header with title and action buttons */
export const PlatformAdminHeader = () => {
  const t = useTranslations();

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-title-md text-neutral-black font-serif">
          {t('platformAdmin_title')}
        </h1>
      </div>
      <Button
        onPress={() => {
          window.open(posthogUIHost, '_blank');
        }}
        color="secondary"
        size="small"
        className="gap-2"
      >
        <LuArrowUpRight className="size-4" />
        {t('platformAdmin_viewAllAnalytics')}
      </Button>
    </div>
  );
};
