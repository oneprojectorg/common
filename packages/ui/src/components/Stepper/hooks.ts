import { useState } from 'react';

import type { StepperItem } from './types';

export const useStepper = ({
  items,
  initialStep = 0,
}: {
  items: Array<StepperItem>;
  initialStep?: number;
}) => {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const totalSteps = items.length;

  const goToStep = (step: number) => {
    setCurrentStep(step);
  };

  const nextStep = (values: Record<string, unknown> = {}) => {
    const success = () =>
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));

    // run the validations if they exist
    const schema = items[currentStep]?.validator;

    if (!schema) {
      success();

      return;
    }

    const currentValues = Object.keys(schema.shape).reduce(
      (acc: Record<string, unknown>, key: string) => {
        acc[key] = values[key];

        return acc;
      },
      {},
    );

    const result = schema.safeParse(currentValues);

    if (result.success) {
      success();
    } else {
      return result.error.formErrors.fieldErrors;
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  return { currentStep, goToStep, nextStep, prevStep };
};
