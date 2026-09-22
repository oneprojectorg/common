'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@op/sense/Accordion';
import { useState } from 'react';
import { LuCircleCheckBig } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { StepHeading } from '../StepHeading';
import { PHASE_TYPE_LABEL } from '../content';
import type { ProcessPiece } from '../types';
import { calloutIcon } from './calloutIcons';

/**
 * Step 4 — the mapping walkthrough, as a numbered rail. Controlled so that
 * exactly one step is open: clicking the open one yields an empty value, which
 * is ignored, and the page never reads as a list of closed rows.
 */
export function MappingStep({
  pieces,
  /** Set for the "other" pathway: what we understood, in their words. */
  recap,
}: {
  pieces: ProcessPiece[];
  recap?: string;
}) {
  const t = useTranslations('decisions.createWizard');
  const [open, setOpen] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title={t('mappingHeading')}
        description={t('mappingDescription')}
      />

      {recap ? (
        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-accent p-4">
          <LuCircleCheckBig
            className="mt-0.5 size-5 shrink-0 text-primary"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-base font-strong">{t('recapHeading')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {recap} {t('recapHint')}
            </p>
          </div>
        </div>
      ) : null}

      <div className="relative">
        {/* The rail, inset to the centre of a node — 11px down, per the margin
            in PieceRow — so it runs between the first and last rather than
            past them. A sibling of the list, because an `ol` may only contain
            `li`. */}
        {pieces.length > 1 ? (
          <span
            aria-hidden
            className="absolute start-4.25 top-2.75 bottom-2.75 w-0.5 -translate-x-1/2 bg-border rtl:translate-x-1/2"
          />
        ) : null}

        <Accordion
          value={[open]}
          onValueChange={(next) => {
            const added = next.find(
              (value) => typeof value === 'number' && value !== open,
            );

            if (typeof added === 'number') {
              setOpen(added);
            }
          }}
          // `role` restated: the flex display these carry drops the list role
          // in WebKit, and with it VoiceOver's "item M of N".
          render={<ol role="list" />}
          className="gap-3"
        >
          {pieces.map((piece, index) => (
            <PieceRow
              key={`${piece.name}-${index}`}
              piece={piece}
              step={index}
            />
          ))}
        </Accordion>
      </div>
    </div>
  );
}

function PieceRow({ piece, step }: { piece: ProcessPiece; step: number }) {
  const t = useTranslations('decisions.createWizard');
  const title = t(piece.name);
  const phase = t(PHASE_TYPE_LABEL[piece.phaseType]);

  return (
    <AccordionItem
      value={step}
      render={<li role="listitem" />}
      className="group/item flex items-start gap-4 border-none"
    >
      {/* The row is the target, so the number is decoration; the trigger's
          label carries it. `relative` puts it over the positioned rail. */}
      <span
        aria-hidden
        className="relative mt-2.75 grid size-8.5 shrink-0 place-items-center rounded-full border-[1.5px] border-border bg-background text-sm text-muted-foreground transition-colors group-data-open/item:border-primary group-data-open/item:bg-primary group-data-open/item:font-strong group-data-open/item:text-primary-foreground motion-reduce:transition-none"
      >
        {step + 1}
      </span>

      <div className="min-w-0 flex-1 overflow-hidden rounded-lg border bg-background">
        {/* The ordinal is real content, not an aria-label: a label would
            override the visible text and drop the phase from the name. The
            focus ring is inset because the card clips an outward one. */}
        <AccordionTrigger className="w-full items-center gap-4 rounded-none border-0 px-5 py-3.5 hover:bg-muted/40 hover:no-underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring **:data-[slot=accordion-trigger-icon]:hidden">
          <span className="sr-only">
            {t('stepOrdinal', { step: step + 1 })}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{title}</span>
            <span className="hidden text-sm font-normal text-muted-foreground group-aria-expanded/accordion-trigger:block">
              {phase}
            </span>
          </span>
          <span className="shrink-0 text-sm font-normal text-muted-foreground group-aria-expanded/accordion-trigger:hidden">
            {phase}
          </span>
        </AccordionTrigger>

        <AccordionContent className="grid pt-0 pb-0 sm:grid-cols-[1fr_42%]">
          <div className="flex min-w-0 flex-col px-5 pb-5">
            {piece.description ? (
              <p className="mb-4 text-sm text-muted-foreground">
                {t(piece.description)}
              </p>
            ) : null}

            <ul role="list" className="flex flex-col gap-4">
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

            {piece.norm ? (
              <p className="mt-4 text-sm text-muted-foreground italic">
                {t(piece.norm)}
              </p>
            ) : null}
          </div>

          {/* Placeholder in the real slot at the real size; no asset ships yet. */}
          <div
            aria-hidden
            className="min-h-32 bg-gradient-to-b from-accent via-primary/15 to-primary/30"
          />
        </AccordionContent>
      </div>
    </AccordionItem>
  );
}
