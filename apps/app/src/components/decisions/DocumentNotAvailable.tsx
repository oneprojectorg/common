'use client';

import { cn } from '@op/ui/utils';
import { LuFileQuestion } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

/** Shown when document content failed to load from the collaboration server. */
export function DocumentNotAvailable({ className }: { className?: string }) {
  const t = useTranslations();

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-8 text-center',
        className,
      )}
    >
      <div className="flex size-8 items-center justify-center rounded-full bg-accent">
        <LuFileQuestion className="size-4 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">
        {t('Content could not be loaded')}
      </p>
    </div>
  );
}
