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
      className="pointer-events-none absolute inset-x-0 bottom-0 h-intro-wash animate-intro-wash overflow-hidden mask-t-from-15% mask-t-to-95% opacity-65 motion-reduce:animate-none"
    >
      <div className="absolute inset-0 bg-gradient opacity-50 blur-3xl" />

      <div className="absolute -start-1/4 -bottom-1/3 size-intro-blob-a animate-intro-blob-a rounded-full bg-gradient opacity-50 blur-3xl motion-reduce:animate-none" />
      <div className="absolute -end-1/4 -bottom-1/4 size-intro-blob-b animate-intro-blob-b rounded-full bg-gradient opacity-40 blur-3xl motion-reduce:animate-none" />
    </div>
  );
}
