import { useState } from 'react';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { z } from 'zod';

export interface StepperItem {
  key: number;
  label: string;
  validator?: z.ZodObject<Record<string, z.ZodTypeAny>>;
  component: ReactNode;
}

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
      console.log('Validation errors', result.error.formErrors.fieldErrors);
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  return { currentStep, goToStep, nextStep, prevStep };
};

export const StepItem = ({
  currentStep,
  itemIndex,
  children,
}: {
  currentStep: number;
  itemIndex: number;
  children: ReactNode;
}) => (
  <div className={cn(currentStep !== itemIndex && 'hidden')}>{children}</div>
);

export const StepperProgressIndicator = ({
  items,
  currentStep = 0,
  goToStep,
}: {
  items: Array<StepperItem>;
  currentStep?: number;
  goToStep?: (step: number) => void;
}) => {
  const segmentSize = 100 / items.length;
  const progress = items.length > 1 ? (currentStep + 1) * segmentSize : 0;

  return (
    <div className="relative flex h-1 w-full gap-0 bg-gradient">
      <motion.div
        className="absolute left-0 top-0 h-full bg-white/65"
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5 }}
      />

      {items.map((item, i) => (
        <button
          type="button"
          key={item.key}
          title={item.label}
          className="z-10 size-full"
          onClick={goToStep ? () => goToStep(i) : undefined}
        />
      ))}
    </div>
  );
};
