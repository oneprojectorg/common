import { useState } from 'react';
import { z } from 'zod';

import type { StepperItem } from './types';

/** Field-name → validation messages, as produced by zod's flattenError. */
type StepFieldErrors = Record<string, string[] | undefined>;

/**
 * Result of attempting to advance: a tagged union so callers can't silently
 * drop validation failures (the reason a bare error-return was avoided).
 */
type NextStepResult = { ok: true } | { ok: false; errors: StepFieldErrors };

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
   * Returns `{ ok: true }` when it advanced, or `{ ok: false, errors }` with a
   * field-error map when validation failed — branch on `ok` to render errors.
   */
  const nextStep = (values: Record<string, unknown> = {}): NextStepResult => {
    const success = () =>
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));

    // run the validations if they exist
    const schema = items[currentStep]?.validator;

    if (!schema) {
      success();

      return { ok: true };
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

      return { ok: true };
    }

    return { ok: false, errors: z.flattenError(result.error).fieldErrors };
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  return { currentStep, goToStep, nextStep, prevStep };
};
