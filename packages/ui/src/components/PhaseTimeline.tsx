'use client';

import { LuArrowRight, LuCheck, LuPlay } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { formatDateRange } from '../utils/formatting';
import { Button } from './Button';
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
  /** Destination for the current phase card (its whole row links here). */
  href?: string;
}

/**
 * Vertical phase timeline for the decision Overview sidebar. Each phase renders
 * in one of four treatments derived from its position relative to the current
 * phase (plus the admin "advanceable" flag):
 *
 * - completed (before current): compact, green rail + check + dates + name
 * - current: filled teal card linking to `href`, dates + optional "Now open!"
 *   tag + name + arrow
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
  href,
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
          href={href}
        />
      ))}
    </ol>
  );
}

interface PhaseContentProps {
  phase: Phase;
  locale?: string;
  className?: string;
}

const PhaseDates = ({ phase, locale, className }: PhaseContentProps) => {
  if (!phase.startDate && !phase.endDate) {
    return null;
  }

  return (
    <span className={cn('text-sm', className)}>
      {formatDateRange(phase.startDate, phase.endDate, locale)}
    </span>
  );
};

const PhaseName = ({ phase, className }: PhaseContentProps) => (
  <p className={cn('font-serif text-title-base font-light', className)}>
    <bdi>{phase.name}</bdi>
  </p>
);

type PhaseRowProps = Pick<
  PhaseTimelineProps,
  'locale' | 'nowOpenLabel' | 'advanceLabel' | 'onAdvance' | 'href'
> & {
  phase: Phase;
  state: PhaseState;
  isNowOpen: boolean;
  isAdvanceable: boolean;
};

const PhaseRow = ({
  phase,
  state,
  locale,
  isNowOpen,
  nowOpenLabel,
  isAdvanceable,
  advanceLabel,
  onAdvance,
  href,
}: PhaseRowProps) => {
  if (state === 'completed') {
    return (
      <li className="flex flex-col gap-2 border-l border-functional-green-100 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="flex size-4 items-center justify-center rounded-full bg-functional-greenWhite text-functional-green">
            <LuCheck className="size-3" aria-hidden />
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
      <li>
        <a
          className="flex items-center justify-between gap-4 rounded-xl bg-primary-100 p-4 transition hover:bg-primary-200"
          href={href}
        >
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex items-center gap-4">
              <PhaseDates
                phase={phase}
                locale={locale}
                className="text-primary-tealBlack"
              />
              {isNowOpen ? (
                <span className="rounded-md bg-primary-tealBlack px-1.5 py-1 text-sm text-neutral-offWhite">
                  {nowOpenLabel}
                </span>
              ) : null}
            </div>
            <PhaseName phase={phase} className="text-primary-tealBlack" />
          </div>
          <LuArrowRight className="size-4 shrink-0" aria-hidden />
        </a>
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
          <LuPlay className="size-4 fill-current" aria-hidden />
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
