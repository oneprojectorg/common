'use client';

import { Button } from '@op/sense/Button';
import { LuArrowRight } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { StepHeading } from '../StepHeading';

/** Step 1 — a title page, not a question; carries its own primary action. */
export function IntroStep({ onStart }: { onStart: () => void }) {
  const t = useTranslations('decisions.createWizard');

  return (
    // Padding at one end moves the centre by half of it, so `pb-50` lifts the
    // block 100px and leaves the wash below room to be seen.
    <div className="relative flex flex-1 flex-col items-center justify-center pb-50">
      <StepHeading
        size="display"
        title={t('introHeading')}
        description={t('introDescription')}
        className="animate-rise-in motion-reduce:animate-none"
      />

      <Button
        onClick={onStart}
        className="mt-8 animate-rise-in [animation-delay:150ms] motion-reduce:animate-none"
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
      // A positioned sibling *before* the `relative` content, not a negative
      // z-index — that puts it behind the page background and paints nothing.
      // The fade goes on the clipping box; on the blobs it showed as a hairline.
      // The rise is invisible on a wash this soft, so it reads as a fade.
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[calc(60%-75px)] animate-rise-in overflow-hidden opacity-65 [animation-duration:1.2s] motion-reduce:animate-none"
      style={{
        maskImage: 'linear-gradient(to top, black 15%, transparent 95%)',
        WebkitMaskImage: 'linear-gradient(to top, black 15%, transparent 95%)',
      }}
    >
      {/* A still floor under the moving blobs, so their travel can be large
          enough to read without uncovering the side of the box. */}
      <div className="absolute inset-0 bg-gradient opacity-50 blur-3xl" />

      <div className="absolute -start-1/4 -bottom-1/3 size-[115%] animate-[intro-blob-a_14s_ease-in-out_infinite] rounded-full bg-gradient opacity-50 blur-3xl motion-reduce:animate-none" />
      {/* Overlapping by design: side by side they read as two shapes. */}
      <div className="absolute -end-1/4 -bottom-1/4 size-[110%] animate-[intro-blob-b_20s_ease-in-out_infinite] rounded-full bg-gradient opacity-40 blur-3xl motion-reduce:animate-none" />
    </div>
  );
}
