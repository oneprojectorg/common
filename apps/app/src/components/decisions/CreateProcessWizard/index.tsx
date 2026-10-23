'use client';

import { Button } from '@op/sense/Button';
import { Progress } from '@op/sense/Progress';
import { cn } from '@op/sense/lib/utils';
import { type ReactNode, useEffect, useMemo, useReducer, useRef } from 'react';
import { LuArrowLeft, LuArrowRight, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ChoiceScreen } from './ChoiceScreen';
import { STEP_HEADING_ID } from './StepHeading';
import { composeOtherPhases, describeOther } from './composeOther';
import {
  INITIAL_STATE,
  TOTAL_STEPS,
  isChoiceScreen,
  isScreenComplete,
  nextScreen,
  progressPercent,
  screenOf,
  stepOf,
  wizardReducer,
  type ScreenId,
  type WizardAnswers,
  type WizardState,
} from './flow';
import { applyGrantDecision, presetPhases } from './phasePresets';
import { IntroBackdrop, IntroStep } from './steps/IntroStep';
import { MappingStep } from './steps/MappingStep';
import { NameAccessStep } from './steps/NameAccessStep';
import type { ProcessDraft, WizardPhase } from './types';

interface ScreenBodyProps {
  screen: ScreenId;
  answers: WizardAnswers;
  phases: WizardPhase[];
  recap?: ReactNode;
  onAnswer: (patch: Partial<WizardAnswers>) => void;
  onStart: () => void;
  onSubmit: () => void;
}

export function CreateProcessWizard({
  initial,
  onProgressChange,
  onExit,
  onComplete,
  isSubmitting = false,
}: {
  initial?: WizardState | null;
  onProgressChange?: (state: WizardState) => void;
  onExit: () => void;
  onComplete: (draft: ProcessDraft) => void;
  isSubmitting?: boolean;
}) {
  const t = useTranslations('decisions.createWizard');
  const tShared = useTranslations();

  const [state, dispatch] = useReducer(wizardReducer, initial ?? INITIAL_STATE);
  const { screen, answers } = state;
  const { type, name } = answers;

  useEffect(() => {
    onProgressChange?.(state);
  }, [onProgressChange, state]);

  const answer = (patch: Partial<WizardAnswers>) =>
    dispatch({ type: 'answer', patch });

  const step = stepOf(screen);
  // Not before step 4, so answering step 3 doesn't recompose the phases.
  const isResolved = step >= 4;
  const phases = useMemo(
    () => (isResolved ? resolvePhases(answers) : []),
    [isResolved, answers],
  );

  const canContinue = isScreenComplete(screen, answers);

  // Focus the new step's heading so it is announced; not on mount.
  const hasStepped = useRef(false);

  useEffect(() => {
    if (!hasStepped.current) {
      hasStepped.current = true;

      return;
    }

    document.getElementById(STEP_HEADING_ID)?.focus();
  }, [screen]);

  const advance = () => {
    if (!canContinue || isSubmitting) {
      return;
    }

    if (nextScreen(screen, answers) === null) {
      if (type) {
        onComplete({ type, name: name.trim(), phases });
      }

      return;
    }

    dispatch({ type: 'next' });
  };

  let primaryLabel = tShared('Continue');
  if (step === 1) {
    primaryLabel = t('getStartedAction');
  } else if (step === TOTAL_STEPS) {
    primaryLabel = t('submitAction');
  }

  return (
    <div className="flex h-dvh flex-col bg-muted">
      {step > 1 ? (
        <Progress
          value={progressPercent(screen, type)}
          aria-label={t('stepProgress', {
            current: step,
            total: TOTAL_STEPS,
          })}
          className="h-1 shrink-0 rounded-none"
        />
      ) : null}

      <div className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 sm:px-6">
        {step === 1 ? (
          <Button
            variant="outline"
            size="icon"
            aria-label={tShared('Close')}
            disabled={isSubmitting}
            onClick={onExit}
          >
            <LuX className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button
            variant="link"
            disabled={isSubmitting}
            onClick={() => dispatch({ type: 'back' })}
          >
            <LuArrowLeft className="rtl:-scale-x-100" />
            {tShared('Back')}
          </Button>
        )}

        {step === 1 ? (
          <Button
            variant="link"
            disabled={isSubmitting}
            onClick={() =>
              onComplete({
                type: 'other',
                name: t('untitledProcessName'),
                phases: [],
              })
            }
          >
            {t('createBlankAction')}
          </Button>
        ) : (
          <Button variant="outline" disabled={isSubmitting} onClick={onExit}>
            {tShared('Exit')}
          </Button>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        {step === 1 ? <IntroBackdrop /> : null}
        <div
          className={cn(
            'mx-auto flex w-full px-4 sm:px-6',
            step === 1 ? 'flex-1' : 'flex-col pt-8',
            step > 1 && (step === 4 ? 'pb-40' : 'pb-12'),
            step === 4 ? 'max-w-177' : 'max-w-lg',
          )}
        >
          <ScreenBody
            screen={screen}
            answers={answers}
            phases={phases}
            recap={
              type === 'other' && isResolved
                ? describeOther(answers, t)
                : undefined
            }
            onAnswer={answer}
            onStart={advance}
            onSubmit={advance}
          />

          {step > 1 ? (
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

function ScreenBody({
  screen,
  answers,
  phases,
  recap,
  onAnswer,
  onStart,
  onSubmit,
}: ScreenBodyProps) {
  const current = screenOf(screen);

  if (isChoiceScreen(current)) {
    return (
      <ChoiceScreen screen={current} answers={answers} onAnswer={onAnswer} />
    );
  }

  switch (current.id) {
    case 'intro':
      return <IntroStep onStart={onStart} />;
    case 'mapping':
      return <MappingStep phases={phases} recap={recap} />;
    case 'name':
      return (
        <NameAccessStep
          name={answers.name}
          onNameChange={(name) => onAnswer({ name })}
          onSubmit={onSubmit}
        />
      );
  }
}

function resolvePhases(answers: WizardAnswers): WizardPhase[] {
  const { type, shape, grantDecision } = answers;

  if (type === 'other') {
    return composeOtherPhases(answers);
  }

  if (type === 'grant') {
    return applyGrantDecision(presetPhases(type, shape), grantDecision);
  }

  return presetPhases(type, shape);
}
