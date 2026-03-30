'use client';

import { LuCheck, LuPlay } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { formatDateRange } from '../utils/formatting';

export interface Phase {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  sortOrder?: number;
  interactive?: boolean;
}

type StepState = 'completed' | 'current' | 'upcoming';

interface PhaseStepperProps {
  phases: Phase[];
  currentPhaseId: string;
  className?: string;
  onTransition?: (phaseId: string) => void;
}

const StepIndicator = ({
  stepState,
  index,
  phase,
  onTransition,
}: {
  stepState: StepState;
  index: number;
  phase: Phase;
  onTransition?: (phaseId: string) => void;
}) => {
  const baseStyles = cn(
    'flex size-6 items-center justify-center rounded-full font-serif transition-all',
    stepState === 'completed' &&
      'bg-functional-greenWhite text-functional-green',
    stepState === 'current' && 'bg-neutral-charcoal text-neutral-offWhite',
    stepState === 'upcoming' &&
      'border border-neutral-charcoal bg-transparent text-neutral-charcoal',
  );

  const content =
    stepState === 'completed' ? <LuCheck className="size-4" /> : index + 1;

  if (!phase.interactive) {
    return <div className={baseStyles}>{content}</div>;
  }

  return (
    <div className="relative flex size-8 items-center justify-center">
      <div
        className="absolute size-8 rounded-full"
        style={{
          border:
            '1px solid color-mix(in srgb, var(--color-primary-teal) 12%, transparent)',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 28,
          height: 28,
          border:
            '1px solid color-mix(in srgb, var(--color-primary-teal) 32%, transparent)',
        }}
      />
      <button
        type="button"
        aria-label={`Advance to ${phase.name}`}
        onClick={() => onTransition?.(phase.id)}
        className={cn(
          baseStyles,
          'relative cursor-pointer border-0 bg-primary-teal text-neutral-offWhite',
        )}
      >
        {stepState === 'completed' ? (
          <LuCheck className="size-4" />
        ) : (
          <LuPlay className="size-3 fill-current" />
        )}
      </button>
    </div>
  );
};

const Step = ({
  stepState,
  index,
  phase,
  onTransition,
}: {
  stepState: StepState;
  index: number;
  phase: Phase;
  onTransition?: (phaseId: string) => void;
}) => {
  return (
    <div className="flex flex-col items-center gap-1 text-title-xs">
      <StepIndicator
        stepState={stepState}
        index={index}
        phase={phase}
        onTransition={onTransition}
      />
      <div className="flex max-w-6 flex-col items-center justify-center text-sm text-nowrap text-neutral-black">
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
  onTransition,
}: PhaseStepperProps) {
  const sortedPhases = phases
    .slice()
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const currentPhaseIndex = sortedPhases.findIndex(
    (phase) => phase.id === currentPhaseId,
  );

  const getStepState = (index: number): StepState => {
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
              <Step
                stepState={stepState}
                index={index}
                phase={phase}
                onTransition={onTransition}
              />
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
