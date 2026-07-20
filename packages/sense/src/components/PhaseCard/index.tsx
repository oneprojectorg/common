'use client';

import { LuArrowRight, LuCheck, LuPlay } from 'react-icons/lu';

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
  /** Render the Advance button (upcoming card the viewer can advance into). */
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

/** Completed: compact, green rail + check + dates + name. */
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
        'flex flex-col gap-2 border-s border-success/30 px-4 py-2',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-4 items-center justify-center rounded-full bg-success-muted text-success">
          <LuCheck className="size-3" aria-hidden />
        </span>
        <PhaseDates
          startDate={startDate}
          endDate={endDate}
          locale={locale}
          className="text-muted-foreground"
        />
      </div>
      <PhaseName name={name} />
    </li>
  );
}

/** Current: filled teal card linking to `href`, optional "Now open!" tag + arrow. */
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
        className="flex items-center justify-between gap-4 rounded-xl bg-teal-100 p-4 text-teal-900 transition hover:bg-teal-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center gap-4">
            <PhaseDates
              startDate={startDate}
              endDate={endDate}
              locale={locale}
            />
            {isNowOpen ? (
              <Badge className="bg-teal-900 text-background">
                {nowOpenLabel}
              </Badge>
            ) : null}
          </div>
          <PhaseName name={name} />
        </div>
        <LuArrowRight className="size-4 shrink-0 rtl:rotate-180" aria-hidden />
      </a>
    </li>
  );
}

/** Upcoming + advanceable: muted card with an Advance button. */
function AdvanceablePhaseCard({
  name,
  startDate,
  endDate,
  locale,
  className,
  advanceLabel = 'Advance',
  onAdvance,
}: PhaseContentProps & Pick<PhaseCardProps, 'advanceLabel' | 'onAdvance'>) {
  return (
    <li
      className={cn(
        'flex items-center justify-between gap-4 rounded-xl bg-muted p-4',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-2">
        <PhaseDates
          startDate={startDate}
          endDate={endDate}
          locale={locale}
          className="text-muted-foreground"
        />
        <PhaseName name={name} />
      </div>
      <Button
        variant="secondary"
        onClick={() => onAdvance?.()}
        className="shrink-0"
      >
        <LuPlay className="size-4" aria-hidden />
        {advanceLabel}
      </Button>
    </li>
  );
}

/** Upcoming: compact, gray rail + dates + name. */
function UpcomingPhaseCard({
  name,
  startDate,
  endDate,
  locale,
  className,
}: PhaseContentProps) {
  return (
    <li className={cn('flex flex-col gap-2 border-s px-4 py-2', className)}>
      <PhaseDates
        startDate={startDate}
        endDate={endDate}
        locale={locale}
        className="text-muted-foreground"
      />
      <PhaseName name={name} />
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
    <span className={cn('text-base', className)}>
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

function formatDate(dateString: string, locale: string = 'en-US'): string {
  return new Date(dateString).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  });
}

function formatDateRange(
  startDate?: string,
  endDate?: string,
  locale?: string,
): string {
  if (startDate && endDate) {
    return `${formatDate(startDate, locale)} - ${formatDate(endDate, locale)}`;
  }
  if (startDate) {
    return formatDate(startDate, locale);
  }
  if (endDate) {
    return formatDate(endDate, locale);
  }
  return '';
}

export { PhaseCard, type PhaseCardProps, type PhaseCardState };
