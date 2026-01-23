'use client';

import { cn } from '@op/ui/utils';
import { LuFileQuestion } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

/**
 * Simple empty state component for when proposal/document content is not available.
 * Reusable across different contexts where document content might be missing.
 */
export function DocumentNotAvailable({ className }: { className?: string }) {
  const t = useTranslations();

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-8 text-center',
        className,
      )}
    >
      <div className="flex size-8 items-center justify-center rounded-full bg-neutral-gray1">
        <LuFileQuestion className="size-4 text-neutral-gray4" />
      </div>
      <p className="text-sm text-neutral-gray4">
        {t('Content could not be loaded')}
      </p>
    </div>
  );
}
