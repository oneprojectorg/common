'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@op/sense/Accordion';
import { Separator } from '@op/sense/Separator';
import { LuCheck, LuCircleCheckBig, LuLightbulb } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { StepHeading } from '../StepHeading';
import { PHASE_TYPE_ICON, PHASE_TYPE_LABEL, TYPE_META } from '../content';
import type { ProcessPiece, ProcessType } from '../types';

/**
 * Step 4 — the mapping walkthrough. The teaching part of the wizard: the whole
 * process laid out as the pieces Common will run it with, one open at a time.
 *
 * The pieces are Common's functionality for this *kind* of process, not a claim
 * about the exact sequence of the user's real-world one — which is why nothing
 * here is presented as fixed.
 */
export function MappingStep({
  type,
  pieces,
  /** Set for the "other" pathway: what we understood, in their words. */
  recap,
}: {
  type: ProcessType;
  pieces: ProcessPiece[];
  recap?: string;
}) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title={t("Here's how {subject} could run on Common", {
          subject: t(TYPE_META[type].subjectPhrase),
        })}
        description={t(
          'What each piece does and what you can set up. Open any piece to see more.',
        )}
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

      {/* One open at a time — `multiple` defaults to false. */}
      <Accordion defaultValue={[0]} className="gap-3">
        {pieces.map((piece, index) => (
          <PieceItem
            key={`${piece.name}-${index}`}
            piece={piece}
            value={index}
          />
        ))}
      </Accordion>
    </div>
  );
}

function PieceItem({ piece, value }: { piece: ProcessPiece; value: number }) {
  const t = useTranslations();
  const Icon = PHASE_TYPE_ICON[piece.phaseType];

  return (
    <AccordionItem
      value={value}
      className="rounded-lg border border-border bg-background px-4"
    >
      <AccordionTrigger className="gap-3">
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
            <Icon className="size-4.5" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate">{t(piece.name)}</span>
            <span className="font-sans text-sm font-normal text-muted-foreground">
              {t(PHASE_TYPE_LABEL[piece.phaseType])}
            </span>
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="ps-12">
        {piece.description ? (
          <p className="text-base text-muted-foreground">
            {t(piece.description)}
          </p>
        ) : null}

        <p className="mt-4 text-sm font-strong text-muted-foreground uppercase">
          {t('You can')}
        </p>
        <ul className="mt-2 flex flex-col gap-2">
          {piece.capabilities.map((capability) => (
            <li key={capability} className="flex items-start gap-2.5">
              <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-success-muted text-success">
                <LuCheck className="size-3" aria-hidden />
              </span>
              <span className="text-base">{t(capability)}</span>
            </li>
          ))}
        </ul>

        {piece.norm ? (
          <>
            <Separator className="mt-4" />
            <div className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
              <LuLightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{t(piece.norm)}</span>
            </div>
          </>
        ) : null}
      </AccordionContent>
    </AccordionItem>
  );
}
