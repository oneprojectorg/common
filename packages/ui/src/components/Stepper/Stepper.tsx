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
    <div className="bg-gradient relative z-40 flex h-1 w-full gap-0">
      <div className="absolute inset-0 bg-white/65" />
      <motion.div
        className="bg-gradient absolute left-0 top-0 h-full"
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5 }}
      />
    </div>
  );
};
