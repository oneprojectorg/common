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
  // `step` lives in the URL so refreshes and back/forward stay in sync.
  // nuqs preserves any other query params (e.g. the promote flag + redirect)
  // when updating this one.
  const [stepParam, setStepParam] = useQueryState(
    'step',
    parseAsInteger.withDefault(0),
  );
  // Start at 0 (not the URL value) so SSR and the first client render agree;
  // the effect below validates `stepParam` against current form values and
  // syncs once the store hydrates.
  const [step, setStep] = React.useState(0);
  const [values, setValues] = React.useState<any[]>(initialValues);
  const [error, setError] = React.useState<string | null>(null);

  const goToStep = React.useCallback(
    (targetStep: number) => {
      setStep(targetStep);
      void setStepParam(targetStep);
    },
    [setStepParam],
  );

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

  // Sync step from query param on mount with validation.
  React.useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const stepFromQuery =
      stepParam >= 0 && stepParam < steps.length ? stepParam : 0;

    const currentValues = getStepValues ? getStepValues() : values;

    const firstInvalidStep = findFirstInvalidStepBefore(
      currentValues,
      stepFromQuery,
      schemas,
    );

    if (firstInvalidStep !== -1) {
      goToStep(firstInvalidStep);
      return;
    }

    setStep(stepFromQuery);
  }, [
    stepParam,
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
