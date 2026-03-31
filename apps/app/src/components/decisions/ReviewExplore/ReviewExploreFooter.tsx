'use client';

import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Button } from '@op/ui/Button';
import { FooterBar } from '@op/ui/FooterBar';
import { LuCheck, LuChevronLeft, LuChevronRight } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

interface ReviewExploreFooterProps {
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

export function ReviewExploreFooter({
  onPrev,
  onNext,
  onSubmit,
}: ReviewExploreFooterProps) {
  const t = useTranslations();
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`) ?? false;

  if (isMobile) {
    return (
      <footer className="z-20 shrink-0 border-t border-neutral-gray1 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            color="neutral"
            size="medium"
            onPress={onPrev}
            className="min-w-0 px-3"
          >
            <LuChevronLeft className="size-4" />
            {t('Previous')}
          </Button>

          <div className="min-w-0 flex-1 text-center text-base text-neutral-black">
            {t('{current} of {total}', { current: 3, total: 6 })}
          </div>

          <Button
            color="secondary"
            size="medium"
            onPress={onNext}
            className="min-w-0 px-3"
          >
            {t('Next')}
            <LuChevronRight className="size-4" />
          </Button>

          <div className="h-6 w-px bg-neutral-gray1" />

          <Button
            color="primary"
            size="medium"
            onPress={onSubmit}
            className="px-4"
          >
            <LuCheck className="size-4" />
            {t('Submit')}
          </Button>
        </div>
      </footer>
    );
  }

  return (
    <FooterBar padding="spacious">
      <FooterBar.Start>
        <Button color="neutral" size="medium" onPress={onPrev}>
          <LuChevronLeft className="size-4" />
          {t('Previous')}
        </Button>
      </FooterBar.Start>

      <FooterBar.Center className="gap-2 text-base text-neutral-black">
        <span>
          {t('Proposal {current} of {total}', { current: 3, total: 6 })}
        </span>
        <span className="text-midGray">•</span>
        <span>{t('{count} completed', { count: 2 })}</span>
      </FooterBar.Center>

      <FooterBar.End>
        <Button color="secondary" size="medium" onPress={onNext}>
          {t('Next')}
          <LuChevronRight className="size-4" />
        </Button>
      </FooterBar.End>

      <FooterBar.Divider />

      <FooterBar.End>
        <Button color="primary" size="medium" onPress={onSubmit}>
          <LuCheck className="size-4" />
          {t('Submit review')}
        </Button>
      </FooterBar.End>
    </FooterBar>
  );
}
