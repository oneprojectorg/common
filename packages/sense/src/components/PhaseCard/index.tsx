'use client';

import { LuArrowRight, LuCheck, LuPlay } from 'react-icons/lu';

import { formatDateRange } from '../../lib/formatting';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

type PhaseCardState = 'completed' | 'current' | 'upcoming';

interface PhaseCardProps {
  name: string;
  startDate?: string;
  endDate?: string;
  locale?: string;
  state: PhaseCardState;
  className?: string;
  /** Show the "Now open!" tag (current card accepting proposals). */
  isNowOpen?: boolean;
  nowOpenLabel?: string;
  /** Render the Start button (upcoming card the viewer can advance into). */
  isAdvanceable?: boolean;
  advanceLabel?: string;
  onAdvance?: () => void;
  /** Destination for the current card — the whole row links here. */
  href?: string;
}

/**
 * A single phase row (`<li>`) in the decision Overview timeline. Dispatches to
 * one of four self-contained treatments; the consumer owns the `<ol>`, the
 * completed/current/upcoming derivation, and which phase is now open or
 * advanceable.
 */
function PhaseCard(props: PhaseCardProps) {
  switch (props.state) {
    case 'completed':
      return <CompletedPhaseCard {...props} />;
    case 'current':
      return <CurrentPhaseCard {...props} />;
    case 'upcoming':
      return props.isAdvanceable ? (
        <AdvanceablePhaseCard {...props} />
      ) : (
        <UpcomingPhaseCard {...props} />
      );
  }
}

/** Fields shared by every treatment. */
type PhaseContentProps = Pick<
  PhaseCardProps,
  'name' | 'startDate' | 'endDate' | 'locale' | 'className'
>;

/** Completed: gray rail + name with a green check, dates below. */
function CompletedPhaseCard({
  name,
  startDate,
  endDate,
  locale,
  className,
}: PhaseContentProps) {
  return (
    <li
      className={cn(
        'flex flex-col gap-1 border-s border-success/30 p-4',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <PhaseName name={name} />
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success-muted text-success">
          <LuCheck className="size-3.5" aria-hidden />
        </span>
      </div>
      <PhaseDates
        startDate={startDate}
        endDate={endDate}
        locale={locale}
        className="text-muted-foreground"
      />
    </li>
  );
}

/**
 * Current: filled teal card linking to `href`. Badge over the name, dates
 * below; the navigation arrow reveals on hover/focus (per the Figma master).
 */
function CurrentPhaseCard({
  name,
  startDate,
  endDate,
  locale,
  className,
  isNowOpen,
  nowOpenLabel = 'Now open!',
  href,
}: PhaseContentProps &
  Pick<PhaseCardProps, 'isNowOpen' | 'nowOpenLabel' | 'href'>) {
  return (
    <li className={className}>
      <a
        href={href}
        className="group flex items-center justify-between gap-4 rounded-lg bg-teal-50 p-4 text-teal-600 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <div className="flex min-w-0 flex-col gap-2">
          {isNowOpen ? (
            <Badge className="w-fit bg-teal-500 text-background">
              {nowOpenLabel}
            </Badge>
          ) : null}
          <div className="flex min-w-0 flex-col">
            <PhaseName name={name} />
            <PhaseDates
              startDate={startDate}
              endDate={endDate}
              locale={locale}
            />
          </div>
        </div>
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <LuArrowRight className="size-4 rtl:rotate-180" />
        </span>
      </a>
    </li>
  );
}

/** Upcoming + advanceable: light card, name over dates, with a Start button. */
function AdvanceablePhaseCard({
  name,
  startDate,
  endDate,
  locale,
  className,
  advanceLabel = 'Start',
  onAdvance,
}: PhaseContentProps & Pick<PhaseCardProps, 'advanceLabel' | 'onAdvance'>) {
  return (
    <li
      className={cn(
        'flex items-center justify-between gap-4 rounded-lg bg-gray-50 p-4',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <PhaseName name={name} />
        <PhaseDates
          startDate={startDate}
          endDate={endDate}
          locale={locale}
          className="text-muted-foreground"
        />
      </div>
      <Button
        variant="outline"
        onClick={() => onAdvance?.()}
        className="shrink-0"
      >
        <LuPlay className="size-4" aria-hidden />
        {advanceLabel}
      </Button>
    </li>
  );
}

/** Upcoming: gray rail, name over dates. */
function UpcomingPhaseCard({
  name,
  startDate,
  endDate,
  locale,
  className,
}: PhaseContentProps) {
  return (
    <li className={cn('flex flex-col gap-1 border-s p-4', className)}>
      <PhaseName name={name} />
      <PhaseDates
        startDate={startDate}
        endDate={endDate}
        locale={locale}
        className="text-muted-foreground"
      />
    </li>
  );
}

function PhaseDates({
  startDate,
  endDate,
  locale,
  className,
}: {
  startDate?: string;
  endDate?: string;
  locale?: string;
  className?: string;
}) {
  if (!startDate && !endDate) {
    return null;
  }

  return (
    <span className={cn('text-sm', className)}>
      {formatDateRange(startDate, endDate, locale)}
    </span>
  );
}

function PhaseName({ name }: { name: string }) {
  return (
    <p className="font-serif text-title">
      <bdi>{name}</bdi>
    </p>
  );
}

export { PhaseCard, type PhaseCardProps, type PhaseCardState };
