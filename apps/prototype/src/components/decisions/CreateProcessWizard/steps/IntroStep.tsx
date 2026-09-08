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
    /* Centred, then lifted: a title page's text sits above the middle of the
       window rather than in it, and the space it gives up is where the wash
       below has room to be seen. `pb` rather than a translate, so the block
       still centres inside what is left instead of hanging off the layout —
       which is why it is 200 for a 100px lift: padding at one end moves the
       centre by half of it. */
    <div className="relative flex flex-1 flex-col items-center justify-center pb-50">
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
      /* The fade goes on the clipping box, not on the blobs inside it: on them
         it ran out somewhere other than the box's own edge, and the clip showed
         as a hairline straight across the page. */
      /* One knob for the whole wash's strength. The layers inside carry their
         own opacities as the mix between the still floor and the moving light;
         this multiplies all three, so the wash can be dialled up or down
         without changing how it is built. */
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[calc(60%-75px)] overflow-hidden opacity-65"
      style={{
        maskImage: 'linear-gradient(to top, black 15%, transparent 95%)',
        WebkitMaskImage: 'linear-gradient(to top, black 15%, transparent 95%)',
      }}
    >
      {/* Two blobs rather than one full-bleed gradient. A gradient that covers
          the whole box is nearly uniform once blurred, so moving it changes
          nothing you can see — which is exactly what the old version did. A
          blob has edges, and edges are what make the movement legible.
          `bg-gradient` is the house green-to-teal radial; the blur is what
          turns each one back into light. */}
      {/* A still layer covering the whole box, under the moving ones. Without
          it the blobs had to stay small enough never to uncover an edge, and
          they didn't — swinging wide left a white margin down one side. With a
          floor under them the travel is free to be as large as it needs to be
          to be seen. */}
      <div className="absolute inset-0 bg-gradient opacity-50 blur-3xl" />

      <div className="absolute -bottom-1/3 -left-1/4 size-[115%] animate-[intro-blob-a_14s_ease-in-out_infinite] rounded-full bg-gradient opacity-50 blur-3xl motion-reduce:animate-none" />
      {/* Overlapping the first by design: side by side they left a pale seam
          down the middle of the page, which reads as two shapes rather than one
          wash. Crossing, they stay one field of light that changes shape. */}
      <div className="absolute -right-1/4 -bottom-1/4 size-[110%] animate-[intro-blob-b_20s_ease-in-out_infinite] rounded-full bg-gradient opacity-40 blur-3xl motion-reduce:animate-none" />
    </div>
  );
}
