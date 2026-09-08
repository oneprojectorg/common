'use client';

import { Button } from '@op/sense/Button';
import { LuArrowRight } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { StepHeading } from '../StepHeading';

/**
 * Step 1 — what this flow is for. The wizard is a first-run experience: it
 * teaches what Common does with a process before asking anything about one.
 *
 * The one screen that carries its own primary action rather than leaning on the
 * footer, and the only one with a decorative background — it is a title page,
 * not a question.
 */
export function IntroStep({ onStart }: { onStart: () => void }) {
  const t = useTranslations();

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center">
      <StepHeading
        size="display"
        title={t('Set up your process on Common')}
        description={t(
          'Answer a few quick questions, see how your process can run here, and launch when ready.',
        )}
      />

      <Button onClick={onStart} className="mt-8">
        {t('Get started')}
        <LuArrowRight className="rtl:-scale-x-100" />
      </Button>
    </div>
  );
}

/**
 * The light rising from the bottom of the intro. Decorative, so it is hidden
 * from assistive tech; it sits behind the content and takes no pointer events.
 */
export function IntroBackdrop() {
  return (
    <div
      aria-hidden
      /* No negative z-index: that would put it behind the wizard's own
         background and paint nothing. It stays an absolutely positioned sibling
         before the content, which is `relative`, so the content sits on top. */
      className="pointer-events-none absolute inset-x-0 bottom-0 h-1/5 overflow-hidden"
    >
      {/* Wider than its box on the sides only, so the blur's soft edges clip
          out horizontally while the top stays a fade rather than a line. The
          scale lives in the keyframe, which owns `transform`. */}
      <div className="absolute -inset-x-8 top-0 bottom-0 animate-gradient-drift bg-gradient-to-t from-accent via-accent/60 to-transparent blur-2xl motion-reduce:animate-none" />
    </div>
  );
}
