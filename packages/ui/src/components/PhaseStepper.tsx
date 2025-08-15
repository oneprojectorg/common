'use client';

import { Check } from 'lucide-react';

import { cn } from '../lib/utils';

export interface Phase {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  sortOrder?: number;
}

interface PhaseStepperProps {
  phases: Phase[];
  currentPhaseId: string;
  className?: string;
}

const formatDateRange = (startDate?: string, endDate?: string) => {
  if (!startDate && !endDate) return '';

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (startDate && endDate) {
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  }
  if (startDate) {
    return formatDate(startDate);
  }
  if (endDate) {
    return formatDate(endDate);
  }
  return '';
};

const Step = ({
  stepState,
  index,
  phase,
}: {
  stepState: string;
  index: number;
  phase: Phase;
}) => {
  return (
    <div className="flex flex-col items-center gap-1 text-title-xs">
      <div
        className={cn(
          'flex size-6 items-center justify-center rounded-full font-serif',
          stepState === 'completed' &&
          'bg-functional-greenWhite text-functional-green',
          stepState === 'current' &&
          'bg-neutral-charcoal text-neutral-offWhite',
          stepState === 'upcoming' &&
          'border border-neutral-charcoal bg-transparent text-neutral-charcoal',
        )}
      >
        {stepState === 'completed' ? <Check className="size-4" /> : index + 1}
      </div>
      <div className="flex max-w-6 flex-col items-center justify-center text-nowrap text-sm text-neutral-black">
        <div>{phase.name}</div>
        {(phase.startDate || phase.endDate) && (
          <div className="text-xs text-neutral-gray4">
            {formatDateRange(phase.startDate, phase.endDate)}
          </div>
        )}
      </div>
    </div>
  );
};

export function PhaseStepper({
  phases,
  currentPhaseId,
  className = '',
}: PhaseStepperProps) {
  const sortedPhases = phases
    .slice()
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const currentPhaseIndex = sortedPhases.findIndex(
    (phase) => phase.id === currentPhaseId,
  );

  const getStepState = (index: number) => {
    if (index < currentPhaseIndex) return 'completed';
    if (index === currentPhaseIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-center gap-2">
        {sortedPhases.map((phase, index) => {
          const stepState = getStepState(index);

          return (
            <div key={phase.id} className="flex items-start gap-2">
              <Step stepState={stepState} index={index} phase={phase} />
              {/* divider line */}
              {index < sortedPhases.length - 1 && (
                <div className="flex flex-col items-center">
                  <div className="flex h-6 items-center">
                    <div className="h-[1px] w-28 bg-neutral-gray2" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
