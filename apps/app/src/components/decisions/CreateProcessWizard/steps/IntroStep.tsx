'use client';

import { Button } from '@op/sense/Button';
import { LuArrowRight } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { StepHeading } from '../StepHeading';

export function IntroStep({ onStart }: { onStart: () => void }) {
  const t = useTranslations('decisions.createWizard');

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center pb-50">
      <StepHeading
        size="display"
        title={t('introHeading')}
        description={t('introDescription')}
        className="animate-rise-in motion-reduce:animate-none"
      />

      <Button
        onClick={onStart}
        className="mt-8 animate-rise-in-delayed motion-reduce:animate-none"
      >
        {t('getStartedAction')}
        <LuArrowRight className="rtl:-scale-x-100" />
      </Button>
    </div>
  );
}

export function IntroBackdrop() {
  return (
    <div
      aria-hidden
      // The arbitrary sizes are hand-tuned; the scale has no match.
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[calc(60%-75px)] animate-intro-wash overflow-hidden opacity-65 motion-reduce:animate-none"
      style={{
        maskImage: 'linear-gradient(to top, black 15%, transparent 95%)',
        WebkitMaskImage: 'linear-gradient(to top, black 15%, transparent 95%)',
      }}
    >
      <div className="absolute inset-0 bg-gradient opacity-50 blur-3xl" />

      <div className="absolute -start-1/4 -bottom-1/3 size-[115%] animate-intro-blob-a rounded-full bg-gradient opacity-50 blur-3xl motion-reduce:animate-none" />
      <div className="absolute -end-1/4 -bottom-1/4 size-[110%] animate-intro-blob-b rounded-full bg-gradient opacity-40 blur-3xl motion-reduce:animate-none" />
    </div>
  );
}
