import { useState } from 'react';
import { z } from 'zod';

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

  /**
   * Validate the current step against its zod schema and advance on success.
   * Returns `undefined` when it advanced, or a `fieldErrors` map when
   * validation failed — callers MUST check the return value to surface errors
   * (a bare `onClick={() => nextStep(values)}` silently swallows them).
   */
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
      return z.flattenError(result.error).fieldErrors;
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  return { currentStep, goToStep, nextStep, prevStep };
};
