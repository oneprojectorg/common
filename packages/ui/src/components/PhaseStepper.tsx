'use client';

import { useState } from 'react';
import { LuCheck, LuPlay } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { formatDateRange } from '../utils/formatting';
import { IconButton } from './IconButton';
import { Tooltip, TooltipTrigger } from './Tooltip';

export interface Phase {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  sortOrder?: number;
  interactive?: boolean;
  ariaLabel?: string;
  /** When true, the play button only appears on hover. When false, it's always visible. */
  showOnHoverOnly?: boolean;
}

type StepState = 'completed' | 'current' | 'upcoming';

interface PhaseStepperProps {
  phases: Phase[];
  currentPhaseId: string;
  className?: string;
  locale?: string;
  onTransition?: (phaseId: string) => void;
}

const RIPPLE_COUNT = 3;
const RIPPLE_DURATION_S = 1.5;

const RippleRings = ({ visible }: { visible: boolean }) => (
  <div
    className="pointer-events-none absolute inset-0 flex items-center justify-center"
    style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.15s' }}
  >
    {Array.from({ length: RIPPLE_COUNT }, (_, i) => (
      <div
        key={i}
        className="absolute size-6 rounded-full"
        style={{
          border: '1px solid var(--color-primary-teal)',
          animation: `phase-ripple ${RIPPLE_DURATION_S}s ease-out ${i * (RIPPLE_DURATION_S / RIPPLE_COUNT)}s infinite`,
        }}
      />
    ))}
  </div>
);

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
  const [isHovered, setIsHovered] = useState(false);

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

  const label = phase.ariaLabel ?? `Start ${phase.name}`;
  const showPlayButton = phase.showOnHoverOnly ? isHovered : true;

  return (
    <div
      className="relative flex size-8 items-center justify-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <RippleRings visible={isHovered} />
      {showPlayButton ? (
        <TooltipTrigger>
          <IconButton
            aria-label={label}
            onPress={() => onTransition?.(phase.id)}
            size="small"
            variant="ghost"
            className={cn(
              baseStyles,
              'relative cursor-pointer border-0 bg-primary-teal text-neutral-offWhite hover:bg-primary-teal pressed:bg-primary-teal',
            )}
          >
            {stepState === 'completed' ? (
              <LuCheck className="size-4" />
            ) : (
              <LuPlay className="size-3 fill-current" />
            )}
          </IconButton>
          <Tooltip>{label}</Tooltip>
        </TooltipTrigger>
      ) : (
        <TooltipTrigger>
          <IconButton
            aria-label={label}
            onPress={() => onTransition?.(phase.id)}
            size="small"
            variant="ghost"
            className={baseStyles}
          >
            {content}
          </IconButton>
          <Tooltip>{label}</Tooltip>
        </TooltipTrigger>
      )}
    </div>
  );
};

const Step = ({
  stepState,
  index,
  phase,
  locale,
  onTransition,
}: {
  stepState: StepState;
  index: number;
  phase: Phase;
  locale?: string;
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
            {formatDateRange(phase.startDate, phase.endDate, locale)}
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
  locale,
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
      <style>{`
        @keyframes phase-ripple {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
      <div className="flex justify-center gap-2">
        {sortedPhases.map((phase, index) => {
          const stepState = getStepState(index);

          return (
            <div key={phase.id} className="flex items-start gap-2">
              <Step
                stepState={stepState}
                index={index}
                phase={phase}
                locale={locale}
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
