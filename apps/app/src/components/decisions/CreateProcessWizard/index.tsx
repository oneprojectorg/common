'use client';

import { Button } from '@op/sense/Button';
import { Progress } from '@op/sense/Progress';
import { cn } from '@op/sense/lib/utils';
import { useLocale } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LuArrowLeft, LuArrowRight, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { STEP_HEADING_ID } from './StepHeading';
import { applyGrantDecision, piecesFor, type GrantDecision } from './content';
import {
  TOTAL_STEPS,
  canAdvance,
  isOtherScreen,
  progressPercent,
  stepThreeScreens,
  type StepThreeScreen,
} from './flow';
import {
  EMPTY_OTHER,
  composeOtherPieces,
  describeOther,
  type OtherAnswers,
} from './otherFlow';
import { IntroBackdrop, IntroStep } from './steps/IntroStep';
import { MappingStep } from './steps/MappingStep';
import { NameAccessStep } from './steps/NameAccessStep';
import { OtherStep } from './steps/OtherStep';
import { GrantDecisionStep, ShapeStep } from './steps/ShapeStep';
import { TypeStep } from './steps/TypeStep';
import type {
  ProcessDraft,
  ProcessPiece,
  ProcessType,
  ShapeKey,
} from './types';

interface StepBodyProps {
  step: number;
  screen: StepThreeScreen;
  type: ProcessType | null;
  shape: ShapeKey | null;
  grantDecision: GrantDecision | null;
  other: OtherAnswers;
  pieces: ProcessPiece[];
  recap?: string;
  name: string;
  onStart: () => void;
  onTypeChange: (type: ProcessType) => void;
  onShapeChange: (shape: ShapeKey) => void;
  onGrantDecisionChange: (decision: GrantDecision) => void;
  onOtherChange: (patch: Partial<OtherAnswers>) => void;
  onNameChange: (name: string) => void;
  onSubmit: () => void;
}

/** Collects a {@link ProcessDraft}; creating it is the caller's job. */
export function CreateProcessWizard({
  onExit,
  onComplete,
  isSubmitting = false,
}: {
  onExit: () => void;
  onComplete: (draft: ProcessDraft) => void;
  isSubmitting?: boolean;
}) {
  const t = useTranslations('decisions.createWizard');
  // A scoped `t` can't reach the top-level shared labels.
  const tShared = useTranslations();
  const locale = useLocale();

  const [step, setStep] = useState(1);
  const [type, setType] = useState<ProcessType | null>(null);
  const [shape, setShape] = useState<ShapeKey | null>(null);
  const [grantDecision, setGrantDecision] = useState<GrantDecision | null>(
    null,
  );
  const [other, setOther] = useState<OtherAnswers>(EMPTY_OTHER);
  const [subIndex, setSubIndex] = useState(0);
  const [name, setName] = useState('');

  const isOther = type === 'other';
  const screens = stepThreeScreens(type, other);
  // Deferred to step 4, so typing on step 3 doesn't recompose the phases.
  const isResolved = step >= 4;
  const pieces = useMemo(
    () =>
      isResolved ? resolvePieces({ type, shape, grantDecision, other }) : [],
    [isResolved, type, shape, grantDecision, other],
  );
  const screen: StepThreeScreen =
    screens[Math.min(subIndex, screens.length - 1)] ?? 'shape';

  const canContinue = canAdvance({
    step,
    screen,
    type,
    shape,
    grantDecision,
    other,
    name,
  });

  // Focus the heading on a step change so the new question is announced.
  const hasStepped = useRef(false);

  useEffect(() => {
    if (!hasStepped.current) {
      hasStepped.current = true;

      return;
    }

    document.getElementById(STEP_HEADING_ID)?.focus();
  }, [step, subIndex]);

  const pickType = (next: ProcessType) => {
    setType(next);
    setShape(next === 'other' ? 'custom' : null);
    setGrantDecision(null);
    setOther(EMPTY_OTHER);
    setSubIndex(0);
  };

  const advance = () => {
    if (!canContinue || isSubmitting) {
      return;
    }

    if (step === TOTAL_STEPS) {
      if (type && shape) {
        onComplete({
          type,
          shape,
          name: name.trim(),
          pieces,
        });
      }

      return;
    }

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

  const isTypedStep = step === TOTAL_STEPS;
  const primaryLabel =
    step === 1
      ? t('getStartedAction')
      : step === TOTAL_STEPS
        ? t('submitAction')
        : tShared('Continue');

  return (
    <div className="flex h-dvh flex-col bg-muted">
      {step > 1 ? (
        <Progress
          value={progressPercent(step, screen, type)}
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
          <Button variant="link" disabled={isSubmitting} onClick={back}>
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
                shape: 'blank',
                name: t('untitledProcessName'),
                pieces: [],
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
            step === 1 ? '' : step === 4 ? 'pb-40' : 'pb-12',
            step === 4 ? 'max-w-177' : 'max-w-lg',
          )}
        >
          <StepBody
            step={step}
            screen={screen}
            type={type}
            shape={shape}
            grantDecision={grantDecision}
            other={other}
            pieces={pieces}
            recap={
              isOther && isResolved
                ? describeOther(other, t, locale)
                : undefined
            }
            name={name}
            onStart={advance}
            onTypeChange={pickType}
            onShapeChange={setShape}
            onGrantDecisionChange={setGrantDecision}
            onOtherChange={(patch) =>
              setOther((previous) => ({ ...previous, ...patch }))
            }
            onNameChange={setName}
            onSubmit={advance}
          />

          {step > 1 && (canContinue || isTypedStep) ? (
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

function StepBody(props: StepBodyProps) {
  const { step, type } = props;

  if (step === 1) {
    return <IntroStep onStart={props.onStart} />;
  }

  if (step === 2) {
    return <TypeStep value={type} onChange={props.onTypeChange} />;
  }

  if (step === 3) {
    return type ? <StepThree {...props} type={type} /> : null;
  }

  if (step === 4) {
    return type ? (
      <MappingStep pieces={props.pieces} recap={props.recap} />
    ) : null;
  }

  return (
    <NameAccessStep
      name={props.name}
      onNameChange={props.onNameChange}
      onSubmit={props.onSubmit}
    />
  );
}

function StepThree({
  screen,
  type,
  shape,
  grantDecision,
  other,
  onShapeChange,
  onGrantDecisionChange,
  onOtherChange,
}: StepBodyProps & { type: ProcessType }) {
  if (isOtherScreen(screen)) {
    return <OtherStep step={screen} answers={other} onChange={onOtherChange} />;
  }

  if (screen === 'grantDecision') {
    return (
      <GrantDecisionStep
        value={grantDecision}
        onChange={onGrantDecisionChange}
      />
    );
  }

  return <ShapeStep type={type} value={shape} onChange={onShapeChange} />;
}

function resolvePieces({
  type,
  shape,
  grantDecision,
  other,
}: {
  type: ProcessType | null;
  shape: ShapeKey | null;
  grantDecision: GrantDecision | null;
  other: OtherAnswers;
}): ProcessPiece[] {
  if (type === 'other') {
    return composeOtherPieces(other);
  }

  if (type === 'grant') {
    return applyGrantDecision(piecesFor(type, shape), grantDecision);
  }

  return piecesFor(type, shape);
}

export type { ProcessDraft };
