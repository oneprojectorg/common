'use client';

import { useState } from 'react';
import { LuCheck, LuPlay } from 'react-icons/lu';

import { formatDateRange } from '../../lib/formatting';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

interface Phase {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
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

function RippleRings({ visible }: { visible: boolean }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.15s' }}
    >
      {Array.from({ length: RIPPLE_COUNT }, (_, i) => (
        <div
          key={i}
          className="absolute size-6 rounded-full border border-primary"
          style={{
            animation: `phase-ripple ${RIPPLE_DURATION_S}s ease-out ${i * (RIPPLE_DURATION_S / RIPPLE_COUNT)}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function StepIndicator({
  stepState,
  index,
  phase,
  onTransition,
}: {
  stepState: StepState;
  index: number;
  phase: Phase;
  onTransition?: (phaseId: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const baseStyles = cn(
    'flex size-6 items-center justify-center rounded-full font-serif transition-all',
    stepState === 'completed' && 'bg-success-muted text-success',
    stepState === 'current' && 'bg-foreground text-background',
    stepState === 'upcoming' &&
      'border border-foreground bg-transparent text-foreground',
  );

  const content =
    stepState === 'completed' ? <LuCheck className="size-4" /> : index + 1;

  if (!phase.interactive) {
    return <div className={baseStyles}>{content}</div>;
  }

  const label = phase.ariaLabel ?? `Start ${phase.name}`;
  const showPlayButton = phase.showOnHoverOnly ? isHovered : true;

  // Wrapper matches the non-interactive step's size-6 so the icon's centerline
  // lines up exactly with sibling steps. The hover ripple is absolutely-
  // positioned and uses transform scaling to expand visually past this box,
  // so a smaller wrapper doesn't clip the animation.
  return (
    <div
      className="relative flex size-6 items-center justify-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <RippleRings visible={isHovered} />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={label}
              onClick={() => onTransition?.(phase.id)}
              size="icon-xs"
              variant="ghost"
              className={cn(
                baseStyles,
                showPlayButton &&
                  'relative cursor-pointer border-0 bg-primary text-primary-foreground hover:bg-primary active:bg-primary',
              )}
            />
          }
        >
          {showPlayButton ? (
            stepState === 'completed' ? (
              <LuCheck className="size-4" />
            ) : (
              <LuPlay className="size-3 fill-current" />
            )
          ) : (
            content
          )}
        </TooltipTrigger>
        <TooltipContent className="sense">{label}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function Step({
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
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <StepIndicator
        stepState={stepState}
        index={index}
        phase={phase}
        onTransition={onTransition}
      />
      <div className="flex max-w-6 flex-col items-center justify-center text-sm text-nowrap text-foreground">
        <div>{phase.name}</div>
        {(phase.startDate || phase.endDate) && (
          <div className="text-xs text-muted-foreground">
            {formatDateRange(phase.startDate, phase.endDate, locale)}
          </div>
        )}
      </div>
    </div>
  );
}

function PhaseStepper({
  phases,
  currentPhaseId,
  className = '',
  locale,
  onTransition,
}: PhaseStepperProps) {
  const currentPhaseIndex = phases.findIndex(
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
        {phases.map((phase, index) => {
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
              {index < phases.length - 1 && (
                <div className="flex h-6 items-center">
                  <div className="h-px w-28 bg-border" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { PhaseStepper, type Phase };
