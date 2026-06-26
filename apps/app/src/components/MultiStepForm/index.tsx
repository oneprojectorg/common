'use client';

import { parseAsInteger, useQueryState } from 'nuqs';
import React, { ComponentType } from 'react';
import { ZodSchema } from 'zod';

import { findFirstInvalidStepBefore } from './stepValidation';

export type StepProps = {
  value: any;
  onChange: (v: any) => void;
  onNext: (v: any) => void;
  onBack: () => void;
  error?: string | null;
};

export type ProgressComponentProps = {
  numItems: number;
  currentStep?: number;
};

export const MultiStepForm: React.FC<{
  steps: ComponentType<StepProps>[];
  schemas: ZodSchema<any>[];
  initialValues?: any[];
  onFinish?: (allValues: any[]) => void;
  ProgressComponent?: ComponentType<ProgressComponentProps>;
  getStepValues?: () => any[];
  hasHydrated?: boolean;
}> = ({
  steps,
  schemas,
  initialValues = [],
  onFinish,
  ProgressComponent,
  getStepValues,
  hasHydrated = true,
}) => {
  // The current step lives in the `step` query param so back/forward works and
  // other params (e.g. ?promote, ?redirect) are preserved automatically by nuqs.
  const [step, setStep] = useQueryState('step', parseAsInteger.withDefault(0));
  const [values, setValues] = React.useState<any[]>(initialValues);
  const [error, setError] = React.useState<string | null>(null);

  const goToStep = React.useCallback(
    (targetStep: number) => {
      void setStep(targetStep);
    },
    [setStep],
  );

  // Next/back handlers
  const nextStep = React.useCallback(() => {
    if (step < steps.length - 1) {
      goToStep(step + 1);
    }
  }, [step, steps.length, goToStep]);

  const prevStep = React.useCallback(() => {
    if (step > 0) {
      goToStep(step - 1);
    }
  }, [step, goToStep]);

  // Bounce out of an unreachable step (e.g. deep-linked /start?step=3 with no
  // earlier values entered) into the first invalid earlier step. Re-runs when
  // `step` changes — nuqs keeps it in sync with the URL.
  React.useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const boundedStep = step >= 0 && step < steps.length ? step : 0;

    const currentValues = getStepValues ? getStepValues() : values;
    const firstInvalidStep = findFirstInvalidStepBefore(
      currentValues,
      boundedStep,
      schemas,
    );

    if (firstInvalidStep !== -1) {
      goToStep(firstInvalidStep);
      return;
    }

    if (boundedStep !== step) {
      goToStep(boundedStep);
    }
  }, [
    step,
    values,
    goToStep,
    hasHydrated,
    getStepValues,
    schemas,
    steps.length,
  ]);

  const StepComponent = steps[step];

  const handleNext = (stepValue: any) => {
    const schema = schemas[step];

    if (schema) {
      const result = schema.safeParse(stepValue);

      if (!result.success) {
        setError(result.error.issues[0]?.message || 'Invalid input');
        return;
      }
    }

    setError(null);

    const newValues = [...values];
    newValues[step] = stepValue;
    setValues(newValues);

    if (step < steps.length - 1) {
      nextStep();
    } else {
      if (onFinish) {
        onFinish(newValues);
      }
    }
  };

  const handleBack = () => {
    setError(null);
    prevStep();
  };

  if (!StepComponent) {
    return null;
  }

  return (
    <div>
      <StepComponent
        value={values[step]}
        onChange={(v: any) => {
          const newValues = [...values];
          newValues[step] = v;
          setValues(newValues);
        }}
        onNext={handleNext}
        onBack={handleBack}
        error={error}
      />
      {error && (
        <div className="mt-4 font-medium text-functional-red">{error}</div>
      )}
      {ProgressComponent ? (
        <ProgressComponent numItems={steps.length} currentStep={step + 1} />
      ) : null}
    </div>
  );
};
