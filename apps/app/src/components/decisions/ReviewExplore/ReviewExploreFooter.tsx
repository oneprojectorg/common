'use client';

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

  return (
    <FooterBar className="px-4 py-3 sm:px-18 sm:py-2" padding="compact">
      <FooterBar.Start>
        <Button color="neutral" size="medium" onPress={onPrev}>
          <LuChevronLeft className="size-4" />
          {t('Previous')}
        </Button>
      </FooterBar.Start>

      <FooterBar.Center className="hidden gap-2 text-base text-neutral-black sm:flex">
        <span>
          {t('Proposal {current} of {total}', { current: 3, total: 6 })}
        </span>
        <span className="text-midGray">•</span>
        <span>{t('{count} completed', { count: 2 })}</span>
      </FooterBar.Center>

      <FooterBar.Center className="text-base text-neutral-black sm:hidden">
        <span>{t('{current} of {total}', { current: 3, total: 6 })}</span>
      </FooterBar.Center>

      <FooterBar.End>
        <Button color="secondary" size="medium" onPress={onNext}>
          {t('Next')}
          <LuChevronRight className="size-4" />
        </Button>
      </FooterBar.End>

      <FooterBar.Divider />

      <FooterBar.End>
        <Button
          className="sm:hidden"
          color="primary"
          size="medium"
          onPress={onSubmit}
        >
          <LuCheck className="size-4" />
          {t('Submit')}
        </Button>

        <Button
          className="hidden sm:flex"
          color="primary"
          size="medium"
          onPress={onSubmit}
        >
          <LuCheck className="size-4" />
          {t('Submit review')}
        </Button>
      </FooterBar.End>
    </FooterBar>
  );
}
