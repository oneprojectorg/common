'use client';

import { cn } from '@op/sense/lib/utils';
import { useState } from 'react';
import { LuCircleCheckBig } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { StepHeading } from '../StepHeading';
import { PHASE_TYPE_LABEL } from '../content';
import type { ProcessPiece } from '../types';
import { calloutIcon } from './calloutIcons';

/**
 * Step 4 — the mapping walkthrough. The teaching part of the wizard: the whole
 * process laid out as the pieces Common will run it with, one open at a time.
 *
 * A numbered rail rather than a stack of cards, because the thing being taught
 * is a *sequence* — the numbers and the line between them are the shape of the
 * process, and the cards hang off it. Exactly one step is open: this is a
 * selection, not a set of independent toggles, so there is no state where the
 * page is a list of closed rows with nothing to read.
 *
 * The pieces are Common's functionality for this *kind* of process, not a claim
 * about the exact sequence of the user's real-world one — which is why nothing
 * here is presented as fixed.
 */
export function MappingStep({
  pieces,
  /** Set for the "other" pathway: what we understood, in their words. */
  recap,
}: {
  pieces: ProcessPiece[];
  recap?: string;
}) {
  const t = useTranslations();
  /* An index rather than a set: one step is open, and opening another closes
     the one before it. Step 1 on arrival, so the page never opens empty. */
  const [open, setOpen] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title={t("Here's how your process could run on Common")}
        description={t('Explore each step of your process')}
      />

      {recap ? (
        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-accent p-4">
          <LuCircleCheckBig
            className="mt-0.5 size-5 shrink-0 text-primary"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-base font-strong">
              {t("Here's what we understood")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {recap} {t('Change any of it with Back.')}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mx-auto w-full">
        <ol className="relative flex flex-col gap-3">
          {/* The rail. Inset to the centre of a resting node — 11px down, per
              the offsets below — so it runs between the first and last rather
              than past them; the open node sits 6px lower than that, which its
              own 34px hides. It is behind the nodes by paint order, drawn before
              them: a negative z-index put it behind the page's own background
              instead and the line vanished altogether. */}
          {pieces.length > 1 ? (
            <span
              aria-hidden
              className="absolute start-4.25 top-2.75 bottom-2.75 w-0.5 -translate-x-1/2 bg-border rtl:translate-x-1/2"
            />
          ) : null}

          {pieces.map((piece, index) => (
            <PieceRow
              key={`${piece.name}-${index}`}
              piece={piece}
              step={index + 1}
              isOpen={index === open}
              /* Clicking the open one does nothing — it is already the answer,
                 and closing it would leave the page with nothing open. */
              onOpen={() => setOpen(index)}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}

function PieceRow({
  piece,
  step,
  isOpen,
  onOpen,
}: {
  piece: ProcessPiece;
  step: number;
  isOpen: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations();
  const title = t(piece.name);
  const phase = t(PHASE_TYPE_LABEL[piece.phaseType]);

  return (
    <li className="flex items-start gap-4">
      {/* The node is a second way in to the same step, so it is a button and not
          a decoration with a click handler on it. */}
      <button
        type="button"
        aria-label={t('Step {step}: {name}', { step, name: title })}
        aria-current={isOpen ? 'step' : undefined}
        onClick={onOpen}
        className={cn(
          /* `relative` so the rail behind it is actually behind it: the line is
             positioned, and a positioned element paints over static content
             whatever the DOM order — the line ran straight through the circles
             and over their numbers. Positioned too, the later one wins. */
          'relative grid size-8.5 shrink-0 place-items-center rounded-full text-sm',
          'transition-[margin,background-color,border-color,color] motion-reduce:transition-none',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          /* Level with the title beside it, in both states. A resting row is one
             28px line inside 14px of padding, so its centre is 11px down; an open
             card's title is the same line inside 20px, so 17px. The node keeps
             its own centre there, which is the 6px it slides on opening. */
          isOpen
            ? 'mt-4.25 bg-primary font-strong text-primary-foreground'
            : 'mt-2.75 border-[1.5px] border-border bg-background text-muted-foreground hover:border-primary/40',
        )}
      >
        {step}
      </button>

      {isOpen ? (
        /* `overflow-hidden` so the image meets the card's rounded corners: it
           is full bleed on its own half, with nothing laid over it. */
        <div className="grid min-w-0 flex-1 overflow-hidden rounded-lg border bg-background sm:grid-cols-[1fr_42%]">
          <div className="flex min-w-0 flex-col p-5">
            <h3 className="font-serif text-title">{title}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{phase}</p>

            <ul className="mt-4 flex flex-col gap-4">
              {piece.capabilities.map((capability) => {
                const Icon = calloutIcon(capability);

                return (
                  <li key={capability} className="flex items-start gap-2.5">
                    <Icon
                      className="mt-0.5 size-4.5 shrink-0 text-primary"
                      aria-hidden
                    />
                    <span className="text-base">{t(capability)}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <ImageSlot />
        </div>
      ) : (
        /* One line, and the whole row is the target. */
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center justify-between gap-4 rounded-lg border bg-background px-5 py-3.5 text-start transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
        >
          <span className="min-w-0 truncate font-serif text-title">
            {title}
          </span>
          <span className="shrink-0 text-sm text-muted-foreground">
            {phase}
          </span>
        </button>
      )}
    </li>
  );
}

/**
 * The image half. No asset ships with the wizard's content yet, so every step
 * gets the placeholder — but it occupies the real slot at the real size, so
 * dropping pictures in later changes nothing about the layout.
 */
function ImageSlot() {
  return (
    <div
      aria-hidden
      className="min-h-32 bg-gradient-to-br from-accent via-primary/15 to-primary/30"
    />
  );
}
