'use client';

import { Button } from '@op/ui/Button';
import { FooterBar } from '@op/ui/FooterBar';
import { LuCheck, LuChevronLeft, LuChevronRight } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

export function ReviewExploreFooter() {
  const t = useTranslations();

  return (
    <FooterBar padding="spacious">
      <FooterBar.Start>
        <Button color="neutral" size="medium">
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
        <Button color="secondary" size="medium">
          {t('Next')}
          <LuChevronRight className="size-4" />
        </Button>
      </FooterBar.End>

      <FooterBar.Divider />

      <FooterBar.End>
        <Button color="primary" size="medium">
          <LuCheck className="size-4" />
          {t('Submit review')}
        </Button>
      </FooterBar.End>
    </FooterBar>
  );
}
