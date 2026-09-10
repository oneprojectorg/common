'use client';

import { formatDate } from '@/utils/formatting';
import { LuRefreshCw } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

export function RevisedOnBadge({ respondedAt }: { respondedAt: string }) {
  const t = useTranslations();
  return (
    <span className="flex items-center gap-1">
      <LuRefreshCw className="size-4 text-warning" />
      {t('Revised on')} {formatDate(respondedAt)}
    </span>
  );
}
