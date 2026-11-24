'use client';

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

export function ProcessAdminLoadError() {
  const t = useTranslations('decisions');

  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuTriangleAlert className="size-6" aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{t('overviewLoadError')}</EmptyTitle>
        <EmptyDescription>{t('refreshPageHint')}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
