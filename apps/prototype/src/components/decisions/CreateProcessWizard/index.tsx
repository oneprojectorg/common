'use client';

import { Button } from '@op/sense/Button';
import { Progress } from '@op/sense/Progress';
import { cn } from '@op/sense/lib/utils';
import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';
import { LuArrowLeft, LuArrowRight, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { PROTOTYPE_STEWARDS } from '@/components/prototype/fakeUser';

import { STEP_HEADING_ID } from './StepHeading';
import {
  MIN_PROCESS_NAME_LENGTH,
  applyGrantDecision,
  piecesFor,
  type GrantDecision,
} from './content';
import {
  EMPTY_OTHER,
  composeOtherPieces,
  describeOther,
  otherCanContinue,
  otherStepList,
  type OtherAnswers,
  type OtherStep as OtherStepKey,
} from './otherFlow';
import { IntroBackdrop, IntroStep } from './steps/IntroStep';
import { MappingStep } from './steps/MappingStep';
import { NameAccessStep } from './steps/NameAccessStep';
import { OtherStep } from './steps/OtherStep';
import { GrantDecisionStep, ShapeStep } from './steps/ShapeStep';
import { TypeStep } from './steps/TypeStep';
import type { ProcessDraft, ProcessType, ShapeKey } from './types';

const TOTAL_STEPS = 5;

/** Every screen step 3 can show, across all three pathways. */
type StepThreeScreen = OtherStepKey | 'shape' | 'grantDecision';

const isOtherScreen = (screen: StepThreeScreen): screen is OtherStepKey =>
  screen !== 'shape' && screen !== 'grantDecision';

/**
 * The create-process intro wizard — a full-screen, five-step flow:
 *
 *   1 intro · 2 type · 3 shape or the "other" questions · 4 mapping · 5 name
 *
 * Step 3 is a sequence of its own for two pathways: grantmaking asks who
 * decides, and "other" asks four questions that compose their own mapping.
 *
 * It collects a {@link ProcessDraft} and hands it over; creating anything is the
 * caller's job, so the flow stays testable and has one exit point.
 *
 * This is a first-run experience — the mapping step especially is teaching
 * material. It is deliberately shown to everyone for now: there is no
 * repeat-admin design yet, and a half-guessed shortcut would be worse than the
 * full run.
 */
export function CreateProcessWizard({
  onExit,
  onComplete,
  isSubmitting = false,
}: {
  /** Leaving without creating anything — returns where the caller came from. */
  onExit: () => void;
  onComplete: (draft: ProcessDraft) => void;
  /** The caller is creating the process; the last step blocks until it lands. */
  isSubmitting?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();

  const [step, setStep] = useState(1);
  const [type, setType] = useState<ProcessType | null>(null);
  const [shape, setShape] = useState<ShapeKey | null>(null);
  const [grantDecision, setGrantDecision] = useState<GrantDecision | null>(
    null,
  );
  const [other, setOther] = useState<OtherAnswers>(EMPTY_OTHER);
  /** Which screen of step 3's own sequence is showing. */
  const [subIndex, setSubIndex] = useState(0);
  const [name, setName] = useState('');
  const [steward, setSteward] = useState(PROTOTYPE_STEWARDS[0]?.name ?? '');

  const isOther = type === 'other';

  // "Other" composes its phases from the four answers; a grant set is reshaped
  // by who decides; everything else comes straight from the shape.
  const pieces = isOther
    ? composeOtherPieces(other)
    : type === 'grant'
      ? applyGrantDecision(piecesFor(type, shape), grantDecision)
      : piecesFor(type, shape);

  // Step 3's screens, in order, for whichever pathway is running.
  const screens: StepThreeScreen[] = isOther
    ? otherStepList(other)
    : type === 'grant'
      ? ['shape', 'grantDecision']
      : ['shape'];
  // The list is never empty, so the fallback is unreachable — it is here to
  // keep the value a `StepThreeScreen` rather than a possibly-undefined one.
  const screen = screens[Math.min(subIndex, screens.length - 1)] ?? 'shape';

  const canContinue = (() => {
    if (step === 2) {
      return !!type;
    }

    if (step === 3) {
      if (isOtherScreen(screen)) {
        return otherCanContinue(screen, other);
      }

      return screen === 'grantDecision' ? !!grantDecision : !!shape;
    }

    if (step === TOTAL_STEPS) {
      return name.trim().length >= MIN_PROCESS_NAME_LENGTH;
    }

    return true;
  })();

  // A step change is not a navigation, so nothing announces it. Move focus to
  // the new heading: the question gets read out, and keyboard users carry on
  // from the top of the step rather than from the old step's controls.
  useEffect(() => {
    document.getElementById(STEP_HEADING_ID)?.focus();
  }, [step, subIndex]);

  const pickType = (next: ProcessType) => {
    setType(next);
    setShape(next === 'other' ? 'custom' : null);
    setGrantDecision(null);
    setOther(EMPTY_OTHER);
    setSubIndex(0);
  };

  const patchOther = (patch: Partial<OtherAnswers>) =>
    setOther((previous) => ({ ...previous, ...patch }));

  const advance = () => {
    if (!canContinue) {
      return;
    }

    if (step === TOTAL_STEPS) {
      if (type && shape) {
        onComplete({
          type,
          shape,
          name: name.trim(),
          steward,
          // Public by default; the submissions phase page is where this changes.
          audience: 'anyone',
          pieces,
        });
      }

      return;
    }

    // Step 3 can be a sequence of its own — work through it first.
    if (step === 3 && subIndex < screens.length - 1) {
      setSubIndex(subIndex + 1);

      return;
    }

    setStep(step + 1);
  };

  const back = () => {
    if (step === 3 && subIndex > 0) {
      setSubIndex(subIndex - 1);

      return;
    }

    // Coming back into step 3 lands on its last screen.
    if (step === 4) {
      setSubIndex(screens.length - 1);
    }

    setStep((previous) => Math.max(1, previous - 1));
  };

  const stepLabel = t('Step {current} of {total}', {
    current: step,
    total: TOTAL_STEPS,
  });

  // Progress runs smoothly through step 3's sub-steps instead of sticking.
  const progress =
    step === 3
      ? ((2 + (subIndex + 1) / screens.length) / TOTAL_STEPS) * 100
      : (step / TOTAL_STEPS) * 100;

  /* The last step is a field you fill in, so its button is present and
     disabled; every other step is a choice, so its button waits for one. */
  const isTypedStep = step === TOTAL_STEPS;
  const showPrimary = canContinue;

  const primaryLabel =
    step === 1
      ? t('Get started')
      : step === TOTAL_STEPS
        ? t('Set up my process')
        : t('Continue');

  return (
    <div className="flex h-dvh flex-col bg-muted">
      {/* Against the very top edge of the window, ahead of everything: how far
          through you are is a property of the whole screen rather than a
          control in a bar, and up here it needs no number beside it to be
          read. */}
      {step > 1 ? (
        <Progress
          value={progress}
          aria-label={stepLabel}
          className="h-1 shrink-0 rounded-none"
        />
      ) : null}

      {/* `h-14` and a full-size control, matching every other bar in the flow:
          the wizard replaces the app's chrome rather than sitting under it, so
          arriving here shouldn't move the top of the window. */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 sm:px-6">
        {/* Going back a question is the common move once you are in, so it is
            the bar's own control; leaving is the rare one and wears a border to
            say it does something bigger. On the way in there is nothing to go
            back to, so the bar closes instead. */}
        {step === 1 ? (
          <Button
            variant="outline"
            size="icon"
            aria-label={t('Close')}
            onClick={onExit}
          >
            <LuX className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button variant="link" onClick={back}>
            <LuArrowLeft className="rtl:-scale-x-100" />
            {t('Back')}
          </Button>
        )}

        {/* In the page's own corner, and only on the way in: most people should
            answer the questions, and this is for the ones who already know
            their process and just need somewhere to put it. A link, not a
            button — `Get started` is what this screen is for. */}
        {step === 1 ? (
          <Button
            variant="link"
            onClick={() =>
              /* Straight to the page. Naming it is the first thing you do
                 there anyway — the title is a field in the hero — so a screen
                 that asks for a name first is a screen in the way. */
              onComplete({
                type: 'other',
                shape: 'blank',
                name: t('Untitled process'),
                steward,
                audience: 'anyone',
                pieces: [],
              })
            }
          >
            {t('Create blank process')}
          </Button>
        ) : (
          <Button variant="outline" onClick={onExit}>
            {t('Exit')}
          </Button>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        {step === 1 ? <IntroBackdrop /> : null}
        <div
          className={cn(
            'mx-auto flex w-full px-4 sm:px-6',
            step === 1 ? 'flex-1' : 'flex-col pt-8',
            /* The mapping step is the one you read rather than answer, so it
               gets room under its button to scroll past the fold. */
            step === 1 ? '' : step === 4 ? 'pb-40' : 'pb-12',
            /* The mapping step is a quarter wider than the answering steps:
               its cards carry a text column and an image beside it, and at the
               shell's usual width the callouts wrapped every other line. 708 is
               576 plus a quarter of the 528 that was left inside it. */
            step === 4 ? 'max-w-177' : 'max-w-lg',
          )}
        >
          {step === 1 ? <IntroStep onStart={advance} /> : null}

          {step === 2 ? <TypeStep value={type} onChange={pickType} /> : null}

          {step === 3 && type ? (
            isOtherScreen(screen) ? (
              <OtherStep step={screen} answers={other} onChange={patchOther} />
            ) : screen === 'grantDecision' ? (
              <GrantDecisionStep
                value={grantDecision}
                onChange={setGrantDecision}
              />
            ) : (
              <ShapeStep type={type} value={shape} onChange={setShape} />
            )
          ) : null}

          {step === 4 && type ? (
            <MappingStep
              pieces={pieces}
              recap={isOther ? describeOther(other, t, locale) : undefined}
            />
          ) : null}

          {step === TOTAL_STEPS ? (
            <NameAccessStep
              name={name}
              onNameChange={setName}
              steward={steward}
              onStewardChange={setSteward}
            />
          ) : null}

          {/* Under the answers, because that is where you are looking when you
              have finished giving one. On a screen of options it appears with
              the first pick — offered before there is anything to continue
              from, it is a dead control at the bottom of every question. On a
              screen you type into it is there from the start and disabled,
              since an empty field is a thing to fill rather than a choice not
              yet made. */}
          {step > 1 && (showPrimary || isTypedStep) ? (
            <div className="mt-8 flex justify-center">
              <Button
                onClick={advance}
                disabled={!canContinue}
                loading={isSubmitting}
                className="min-w-32"
              >
                {primaryLabel}
                <LuArrowRight className="rtl:-scale-x-100" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export type { ProcessDraft };
