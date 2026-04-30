'use client';

import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { LuCheck, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function formatTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function SaveStatusIndicator({
  status,
  savedAt,
}: {
  status: SaveStatus;
  savedAt?: Date | string;
}) {
  const t = useTranslations();

  if (status === 'idle') {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {status === 'saving' && (
        <>
          <LoadingSpinner className="size-4" />
          <span className="text-muted-foreground">{t('Saving...')}</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <LuCheck className="size-4 text-positive" />
          <span className="text-muted-foreground">
            {savedAt
              ? t('Saved at {time}', { time: formatTime(savedAt) })
              : t('Saved')}
          </span>
        </>
      )}
      {status === 'error' && (
        <>
          <LuX className="size-4 text-destructive" />
          <span className="text-destructive">{t('Failed to save')}</span>
        </>
      )}
    </div>
  );
}
