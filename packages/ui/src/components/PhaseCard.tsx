'use client';

import { Link } from 'react-aria-components';
import { LuArrowRight, LuCheck, LuPlay } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { formatDateRange } from '../utils/formatting';
import { Button } from './Button';

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
 * A single phase row in the decision Overview timeline. Renders one of four
 * treatments by `state` (+ the `isAdvanceable` flag):
 *
 * - completed: compact, green rail + check + dates + name
 * - current: filled teal card linking to `href`, dates + optional "Now open!"
 *   tag + name + arrow
 * - upcoming: compact, gray rail + dates + name
 * - upcoming + advanceable: off-white card with an Advance button
 *
 * Presentational only and self-contained as an `<li>`; the consumer owns the
 * `<ol>`, the completed/current/upcoming derivation, and which phase is now
 * open or advanceable.
 */
export function PhaseCard({
  name,
  startDate,
  endDate,
  locale,
  state,
  className,
  isNowOpen,
  nowOpenLabel = 'Now open!',
  isAdvanceable,
  advanceLabel = 'Advance',
  onAdvance,
  href,
}: PhaseCardProps) {
  if (state === 'completed') {
    return (
      <li
        className={cn(
          'flex flex-col gap-2 border-l border-functional-green-100 px-4 py-2',
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
  }

  if (state === 'current') {
    return (
      <li className={className}>
        <Link
          href={href}
          className="flex items-center justify-between gap-4 rounded-xl bg-primary-100 p-4 transition hover:bg-primary-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex items-center gap-4">
              <PhaseDates
                startDate={startDate}
                endDate={endDate}
                locale={locale}
                className="text-primary-tealBlack"
              />
              {isNowOpen ? (
                <span className="rounded-md bg-primary-tealBlack px-1.5 py-1 text-sm text-neutral-offWhite">
                  {nowOpenLabel}
                </span>
              ) : null}
            </div>
            <PhaseName name={name} className="text-primary-tealBlack" />
          </div>
          <LuArrowRight className="size-4 shrink-0" aria-hidden />
        </Link>
      </li>
    );
  }

  // upcoming
  if (isAdvanceable) {
    return (
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
          size="small"
          onPress={() => onAdvance?.()}
          className="shrink-0"
        >
          <LuPlay className="size-4 fill-current" aria-hidden />
          {advanceLabel}
        </Button>
      </li>
    );
  }

  return (
    <li
      className={cn(
        'flex flex-col gap-2 border-l border-neutral-gray1 px-4 py-2',
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
}

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
    <span className={cn('text-sm', className)}>
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
  <p className={cn('font-serif text-xl font-light', className)}>
    <bdi>{name}</bdi>
  </p>
);
