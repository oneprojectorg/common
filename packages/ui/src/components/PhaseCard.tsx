'use client';

import { match } from '@op/core';
import { Link } from 'react-aria-components';
import { LuArrowRight, LuCheck, LuPlay } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { formatDateRange } from '../utils/formatting';
import { Button } from './Button';
import { Chip } from './Chip';

export type PhaseCardState = 'completed' | 'current' | 'upcoming';

export interface PhaseCardProps {
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
export function PhaseCard(props: PhaseCardProps) {
  return match(props.state, {
    completed: () => <CompletedPhaseCard {...props} />,
    current: () => <CurrentPhaseCard {...props} />,
    upcoming: () =>
      props.isAdvanceable ? (
        <AdvanceablePhaseCard {...props} />
      ) : (
        <UpcomingPhaseCard {...props} />
      ),
  });
}

/** Fields shared by every treatment. */
type PhaseContentProps = Pick<
  PhaseCardProps,
  'name' | 'startDate' | 'endDate' | 'locale' | 'className'
>;

/** Completed: compact, green rail + check + dates + name. */
const CompletedPhaseCard = ({
  name,
  startDate,
  endDate,
  locale,
  className,
}: PhaseContentProps) => (
  <li
    className={cn(
      'flex flex-col gap-2 border-s border-functional-green-100 px-4 py-2',
      className,
    )}
  >
    <div className="flex items-center gap-2">
      <span className="flex size-4 items-center justify-center rounded-full bg-functional-greenWhite text-functional-green">
        <LuCheck className="size-3" aria-hidden />
      </span>
      <PhaseDates
        startDate={startDate}
        endDate={endDate}
        locale={locale}
        className="text-neutral-charcoal"
      />
    </div>
    <PhaseName name={name} className="text-neutral-black" />
  </li>
);

/** Current: filled teal card linking to `href`, optional "Now open!" tag + arrow. */
const CurrentPhaseCard = ({
  name,
  startDate,
  endDate,
  locale,
  className,
  isNowOpen,
  nowOpenLabel = 'Now open!',
  href,
}: PhaseContentProps &
  Pick<PhaseCardProps, 'isNowOpen' | 'nowOpenLabel' | 'href'>) => (
  <li className={className}>
    <Link
      href={href}
      className="flex items-center justify-between gap-4 rounded-xl bg-primary-100 p-4 text-primary-tealBlack transition hover:bg-primary-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-4">
          <PhaseDates startDate={startDate} endDate={endDate} locale={locale} />
          {isNowOpen ? (
            <Chip className="bg-primary-tealBlack px-1.5 py-0.75 text-sm text-neutral-offWhite">
              {nowOpenLabel}
            </Chip>
          ) : null}
        </div>
        <PhaseName name={name} />
      </div>
      <LuArrowRight className="size-4 shrink-0" aria-hidden />
    </Link>
  </li>
);

/** Upcoming + advanceable: off-white card with an Advance button. */
const AdvanceablePhaseCard = ({
  name,
  startDate,
  endDate,
  locale,
  className,
  advanceLabel = 'Advance',
  onAdvance,
}: PhaseContentProps & Pick<PhaseCardProps, 'advanceLabel' | 'onAdvance'>) => (
  <li
    className={cn(
      'flex items-center justify-between gap-4 rounded-xl bg-neutral-offWhite p-4',
      className,
    )}
  >
    <div className="flex min-w-0 flex-col gap-2">
      <PhaseDates
        startDate={startDate}
        endDate={endDate}
        locale={locale}
        className="text-neutral-charcoal"
      />
      <PhaseName name={name} className="text-neutral-black" />
    </div>
    <Button
      color="secondary"
      onPress={() => onAdvance?.()}
      className="shrink-0"
    >
      <LuPlay className="size-4" aria-hidden />
      {advanceLabel}
    </Button>
  </li>
);

/** Upcoming: compact, gray rail + dates + name. */
const UpcomingPhaseCard = ({
  name,
  startDate,
  endDate,
  locale,
  className,
}: PhaseContentProps) => (
  <li
    className={cn(
      'flex flex-col gap-2 border-s border-neutral-gray1 px-4 py-2',
      className,
    )}
  >
    <PhaseDates
      startDate={startDate}
      endDate={endDate}
      locale={locale}
      className="text-neutral-charcoal"
    />
    <PhaseName name={name} className="text-neutral-black" />
  </li>
);

const PhaseDates = ({
  startDate,
  endDate,
  locale,
  className,
}: {
  startDate?: string;
  endDate?: string;
  locale?: string;
  className?: string;
}) => {
  if (!startDate && !endDate) {
    return null;
  }

  return (
    <span className={cn('text-base', className)}>
      {formatDateRange(startDate, endDate, locale)}
    </span>
  );
};

const PhaseName = ({
  name,
  className,
}: {
  name: string;
  className?: string;
}) => (
  <p
    className={cn('font-serif text-xl/5 font-light tracking-tight', className)}
  >
    <bdi>{name}</bdi>
  </p>
);
