'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import React, { ComponentType } from 'react';
import { ZodSchema } from 'zod';

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

// Types for props
interface MultiStepFormProps {
  steps: ComponentType<StepProps>[];
  schemas: ZodSchema<any>[];
  initialValues?: any[];
  onFinish?: (allValues: any[]) => void;
  ProgressComponent?: ComponentType<ProgressComponentProps>;
}

export const MultiStepForm: React.FC<MultiStepFormProps> = ({
  steps,
  schemas,
  initialValues = [],
  onFinish,
  ProgressComponent,
}) => {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [values, setValues] = React.useState<any[]>(initialValues);
  const [error, setError] = React.useState<string | null>(null);

  // Centralized goToStep that updates both state and query param
  const goToStep = React.useCallback(
    (targetStep: number) => {
      setStep(targetStep);
      const query = { step: targetStep.toString() };

      const params = new URLSearchParams(query);

      // Navigate to the new URL
      router.push(`${window.location.pathname}?${params.toString()}`);
    },
    [router],
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

  const searchParams = useSearchParams();
  // Sync step from query param on mount
  React.useEffect(() => {
    const stepParam = searchParams.get('step');

    let stepFromQuery = 0;
    if (typeof stepParam === 'string') {
      const parsed = parseInt(stepParam, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed < steps.length) {
        stepFromQuery = parsed;
      }
    }
    setStep(stepFromQuery);
  }, [searchParams]);

  const StepComponent = steps[step];

  const handleNext = (stepValue: any) => {
    const schema = schemas[step];

    if (schema) {
      const result = schema.safeParse(stepValue);

      if (!result.success) {
        setError(result.error.errors[0]?.message || 'Invalid input');
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
      {error && <div className="mt-4 font-medium text-red-500">{error}</div>}
      {ProgressComponent ? (
        <ProgressComponent numItems={steps.length} currentStep={step + 1} />
      ) : null}
    </div>
  );
};
