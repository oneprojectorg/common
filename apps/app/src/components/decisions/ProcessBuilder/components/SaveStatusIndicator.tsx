'use client';

import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { LuCheck, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  const t = useTranslations();

  if (status === 'idle') {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {status === 'saving' && (
        <>
          <LoadingSpinner className="size-4" />
          <span className="text-neutral-gray4">{t('Saving...')}</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <LuCheck className="size-4 text-functional-green" />
          <span className="text-neutral-gray4">{t('Saved')}</span>
        </>
      )}
      {status === 'error' && (
        <>
          <LuX className="size-4 text-functional-red" />
          <span className="text-functional-red">{t('Failed to save')}</span>
        </>
      )}
    </div>
  );
}
