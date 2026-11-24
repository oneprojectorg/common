'use client';

import { useRender } from '@base-ui/react/use-render';
import type { ReactElement } from 'react';
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
  /**
   * The link to this phase's editor, as the element to render, e.g. the app's
   * `<Link href={editorHref} />`. When set, the card takes the editing
   * treatment: the whole card is that link, or it carries a Setup link when
   * `needsSetup`.
   */
  editLink?: ReactElement;
  /**
   * The phase is missing what it needs to run. With `editLink`, the card shows
   * `blurb` and a Setup link, except on the current phase, which always links
   * to its editor from the whole card.
   */
  needsSetup?: boolean;
  setupLabel?: string;
  /**
   * Accessible name of the Setup link. Starts with the visible `setupLabel`
   * and names the phase, in the word order of the locale, e.g. "Setup Voting".
   * Defaults to `setupLabel` followed by `name`.
   */
  setupAriaLabel?: string;
  /** Shown in place of the dates on a card that needs setup. */
  blurb?: string;
  /** The first phase that needs setup: its Setup link takes the primary style. */
  isLead?: boolean;
}

type EditingPhaseCardProps = PhaseCardProps & { editLink: ReactElement };

/**
 * One phase row in a phase timeline. Renders a `div`, or the `editLink`
 * element for a ready card in the editing treatment; the consumer owns the
 * `<ol>`, each `<li>`, and the state derivation.
 *
 * Two treatments share one set of props. The resting treatment (the decision
 * Overview and the process admin rail) follows `state`. The editing treatment,
 * chosen by passing `editLink`, links to the phase's editor.
 */
function PhaseCard(props: PhaseCardProps) {
  const { editLink } = props;
  if (editLink) {
    return props.needsSetup && props.state !== 'current' ? (
      <SetupPhaseCard {...props} editLink={editLink} />
    ) : (
      <EditablePhaseCard {...props} editLink={editLink} />
    );
  }

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
    <div
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
    </div>
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
    <div className={className}>
      <a
        href={href}
        data-slot="phase-card-current"
        className="group flex items-center justify-between gap-4 rounded-lg bg-teal-50 p-4 text-teal-600 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
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
          data-slot="phase-card-arrow"
          className="flex size-8 shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
        >
          <LuArrowRight className="size-4 rtl:-scale-x-100" />
        </span>
      </a>
    </div>
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
    <div
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
        <LuPlay className="size-4 rtl:-scale-x-100" aria-hidden />
        {advanceLabel}
      </Button>
    </div>
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
    <div className={cn('flex flex-col gap-1 border-s p-4', className)}>
      <PhaseName name={name} />
      <PhaseDates
        startDate={startDate}
        endDate={endDate}
        locale={locale}
        className="text-muted-foreground"
      />
    </div>
  );
}

const editingCardClassName =
  'flex items-center justify-between gap-4 rounded-lg p-4 ring-1 ring-border ring-inset';

/** Editing, ready: the whole card links to the phase's editor. */
function EditablePhaseCard({
  name,
  startDate,
  endDate,
  locale,
  className,
  isNowOpen,
  nowOpenLabel = 'Now open!',
  editLink,
}: EditingPhaseCardProps) {
  return useRender({
    render: editLink,
    defaultTagName: 'a',
    props: {
      'data-slot': 'phase-card-editable',
      className: cn(
        editingCardClassName,
        'transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none',
        className,
      ),
      children: (
        <>
          <div className="flex min-w-0 flex-col gap-2">
            {isNowOpen ? <Badge variant="outline">{nowOpenLabel}</Badge> : null}
            <div className="flex min-w-0 flex-col">
              <PhaseName name={name} />
              <span className="min-h-5 text-sm text-muted-foreground">
                {formatDateRange(startDate, endDate, locale)}
              </span>
            </div>
          </div>
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center"
          >
            <LuArrowRight className="size-4 rtl:-scale-x-100" />
          </span>
        </>
      ),
    },
  });
}

/** Editing, not ready: name over a blurb, with a Setup link to the phase's editor. */
function SetupPhaseCard({
  name,
  className,
  editLink,
  setupLabel = 'Setup',
  setupAriaLabel = `${setupLabel} ${name}`,
  blurb,
  isLead,
}: EditingPhaseCardProps) {
  return (
    <div
      data-slot="phase-card-setup"
      className={cn(editingCardClassName, className)}
    >
      <div className="flex min-w-0 flex-col">
        <PhaseName name={name} />
        <span className="min-h-5 text-sm text-muted-foreground">
          <bdi>{blurb}</bdi>
        </span>
      </div>
      <Button
        size="sm"
        variant={isLead ? 'default' : 'outline'}
        nativeButton={false}
        role={undefined}
        render={editLink}
        aria-label={setupAriaLabel}
        className="shrink-0"
      >
        {setupLabel}
      </Button>
    </div>
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
