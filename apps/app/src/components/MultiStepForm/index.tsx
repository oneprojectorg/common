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
  // Step lives in the URL so reloads / back-button keep their place; nuqs
  // preserves any other query params on the URL by default.
  const [stepParam, setStepParam] = useQueryState(
    'step',
    parseAsInteger.withDefault(0),
  );
  const [values, setValues] = React.useState<any[]>(initialValues);
  const [error, setError] = React.useState<string | null>(null);

  // Clamp the URL value into a valid step index before handing it to consumers.
  const step =
    stepParam >= 0 && stepParam < steps.length ? stepParam : 0;

  const goToStep = React.useCallback(
    (targetStep: number) => {
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

  // Bounce the user back to the first step whose prereqs aren't met once the
  // store has hydrated (e.g. someone deep-links to step 3 without filling 1-2).
  React.useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const currentValues = getStepValues ? getStepValues() : values;
    const firstInvalidStep = findFirstInvalidStepBefore(
      currentValues,
      step,
      schemas,
    );

    if (firstInvalidStep !== -1) {
      goToStep(firstInvalidStep);
    }
  }, [step, values, goToStep, hasHydrated, getStepValues, schemas]);

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
