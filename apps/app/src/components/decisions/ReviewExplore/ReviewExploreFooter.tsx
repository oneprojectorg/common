'use client';

import { Button } from '@op/ui/Button';
import { LuCheck, LuChevronLeft, LuChevronRight } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

export function ReviewExploreFooter() {
  const t = useTranslations();

  return (
    <footer className="z-20 shrink-0 border-t bg-white/80 px-44 py-2 backdrop-blur">
      <div className="flex items-center gap-4">
        <div className="flex flex-1 items-center gap-4">
          <Button color="neutral" size="medium">
            <LuChevronLeft className="size-4" />
            {t('Previous')}
          </Button>

          <div className="flex flex-1 items-center justify-center gap-2 text-base text-neutral-black">
            <span>
              {t('Proposal {current} of {total}', { current: 3, total: 6 })}
            </span>
            <span className="text-midGray">•</span>
            <span>{t('{count} completed', { count: 2 })}</span>
          </div>

          <Button color="secondary" size="medium">
            {t('Next')}
            <LuChevronRight className="size-4" />
          </Button>
        </div>

        <div className="h-6 w-px bg-offWhite" />

        <Button color="primary" size="medium">
          <LuCheck className="size-4" />
          {t('Submit review')}
        </Button>
      </div>
    </footer>
  );
}
