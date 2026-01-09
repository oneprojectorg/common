import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';

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
  numItems,
  currentStep = 0,
}: {
  numItems: number;
  currentStep?: number;
}) => {
  const segmentSize = 100 / numItems;
  const progress = numItems > 1 ? (currentStep + 1) * segmentSize : 0;

  return (
    <div className="h-1 gap-0 relative z-40 flex w-full bg-gradient">
      <div className="inset-0 absolute bg-white/65" />
      <motion.div
        className="left-0 top-0 absolute h-full bg-gradient"
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5 }}
      />
    </div>
  );
};
