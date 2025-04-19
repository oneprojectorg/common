import { motion } from 'framer-motion';

import { cn } from '../../lib/utils';

import type { StepperItem } from './types';
import type { ReactNode } from 'react';

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
