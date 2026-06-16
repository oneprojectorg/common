'use client';

import { LuArrowRight, LuCheck, LuPlay } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { formatDateRange } from '../utils/formatting';
import { Button } from './Button';
import { IconButton } from './IconButton';
import type { Phase } from './PhaseStepper';

type PhaseState = 'completed' | 'current' | 'upcoming';

export interface PhaseTimelineProps {
  phases: Phase[];
  currentPhaseId: string;
  className?: string;
  locale?: string;
  /**
   * Phase id to flag with the "Now open!" tag — typically the current phase
   * when it is accepting proposals. Omit to hide the tag.
   */
  nowOpenPhaseId?: string;
  nowOpenLabel?: string;
  /**
   * Upcoming phase the viewer can advance into (admin, next phase). Renders the
   * Advance button on that phase's card. Omit when the viewer can't advance.
   */
  advanceablePhaseId?: string;
  advanceLabel?: string;
  onAdvance?: (phaseId: string) => void;
  /** Invoked by the current phase's arrow affordance (e.g. navigate to it). */
  onNavigate?: (phaseId: string) => void;
  navigateAriaLabel?: string;
}

/**
 * Vertical phase timeline for the decision Overview sidebar. Each phase renders
 * in one of four treatments derived from its position relative to the current
 * phase (plus the admin "advanceable" flag):
 *
 * - completed (before current): compact, green rail + check + dates + name
 * - current: filled teal card, dates + optional "Now open!" tag + name + arrow
 * - upcoming: compact, gray rail + dates + name
 * - upcoming + advanceable: off-white card with an Advance button
 *
 * Presentational only — translation, the advance mutation, routing, and admin
 * gating live in the app-side wrapper (cf. PhaseStepper / DecisionProcessStepper).
 */
export function PhaseTimeline({
  phases,
  currentPhaseId,
  className,
  locale,
  nowOpenPhaseId,
  nowOpenLabel = 'Now open!',
  advanceablePhaseId,
  advanceLabel = 'Advance',
  onAdvance,
  onNavigate,
  navigateAriaLabel,
}: PhaseTimelineProps) {
  const currentPhaseIndex = phases.findIndex(
    (phase) => phase.id === currentPhaseId,
  );

  const getPhaseState = (index: number): PhaseState => {
    if (index < currentPhaseIndex) return 'completed';
    if (index === currentPhaseIndex) return 'current';
    return 'upcoming';
  };

  return (
    <ol className={cn('flex flex-col gap-6', className)}>
      {phases.map((phase, index) => (
        <PhaseRow
          key={phase.id}
          phase={phase}
          state={getPhaseState(index)}
          locale={locale}
          isNowOpen={phase.id === nowOpenPhaseId}
          nowOpenLabel={nowOpenLabel}
          isAdvanceable={phase.id === advanceablePhaseId}
          advanceLabel={advanceLabel}
          onAdvance={onAdvance}
          onNavigate={onNavigate}
          navigateAriaLabel={navigateAriaLabel}
        />
      ))}
    </ol>
  );
}

const PhaseDates = ({
  phase,
  locale,
  className,
}: {
  phase: Phase;
  locale?: string;
  className?: string;
}) => {
  if (!phase.startDate && !phase.endDate) {
    return null;
  }

  return (
    <span className={cn('text-sm', className)}>
      {formatDateRange(phase.startDate, phase.endDate, locale)}
    </span>
  );
};

const PhaseName = ({
  phase,
  className,
}: {
  phase: Phase;
  className?: string;
}) => (
  <p className={cn('font-serif text-title-base font-light', className)}>
    <bdi>{phase.name}</bdi>
  </p>
);

const PhaseRow = ({
  phase,
  state,
  locale,
  isNowOpen,
  nowOpenLabel,
  isAdvanceable,
  advanceLabel,
  onAdvance,
  onNavigate,
  navigateAriaLabel,
}: {
  phase: Phase;
  state: PhaseState;
  locale?: string;
  isNowOpen: boolean;
  nowOpenLabel: string;
  isAdvanceable: boolean;
  advanceLabel: string;
  onAdvance?: (phaseId: string) => void;
  onNavigate?: (phaseId: string) => void;
  navigateAriaLabel?: string;
}) => {
  if (state === 'completed') {
    return (
      <li className="flex flex-col gap-2 border-l border-functional-green-100 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="flex size-4 items-center justify-center rounded-full bg-functional-greenWhite text-functional-green">
            <LuCheck className="size-3" />
          </span>
          <PhaseDates
            phase={phase}
            locale={locale}
            className="text-neutral-charcoal"
          />
        </div>
        <PhaseName phase={phase} className="text-neutral-black" />
      </li>
    );
  }

  if (state === 'current') {
    return (
      <li className="flex items-center justify-between gap-4 rounded-xl bg-primary-tealWhite p-4">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center gap-4">
            <PhaseDates
              phase={phase}
              locale={locale}
              className="text-primary-tealBlack"
            />
            {isNowOpen ? (
              <span className="rounded bg-primary-tealBlack px-1.5 py-1 text-sm text-neutral-offWhite">
                {nowOpenLabel}
              </span>
            ) : null}
          </div>
          <PhaseName phase={phase} className="text-primary-tealBlack" />
        </div>
        {onNavigate ? (
          <IconButton
            aria-label={navigateAriaLabel ?? phase.name}
            onPress={() => onNavigate(phase.id)}
            size="small"
            variant="ghost"
            className="shrink-0 text-primary-tealBlack"
          >
            <LuArrowRight className="size-4" />
          </IconButton>
        ) : null}
      </li>
    );
  }

  // upcoming
  if (isAdvanceable) {
    return (
      <li className="flex items-center justify-between gap-4 rounded-xl bg-neutral-offWhite p-4">
        <div className="flex min-w-0 flex-col gap-2">
          <PhaseDates
            phase={phase}
            locale={locale}
            className="text-neutral-charcoal"
          />
          <PhaseName phase={phase} className="text-neutral-black" />
        </div>
        <Button
          color="secondary"
          size="small"
          onPress={() => onAdvance?.(phase.id)}
          className="shrink-0"
        >
          <LuPlay className="size-4 fill-current" />
          {advanceLabel}
        </Button>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 border-l border-neutral-gray1 px-4 py-2">
      <PhaseDates
        phase={phase}
        locale={locale}
        className="text-neutral-charcoal"
      />
      <PhaseName phase={phase} className="text-neutral-black" />
    </li>
  );
};
