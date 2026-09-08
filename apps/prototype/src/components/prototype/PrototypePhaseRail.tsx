'use client';

import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { PhaseCard } from '@op/sense/PhaseCard';
import { DragHandle, Sortable } from '@op/sense/Sortable';
import { cn } from '@op/sense/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { LuArrowRight, LuPlus } from 'react-icons/lu';

import {
  type DateShift,
  PrototypeReorderBlockedModal,
  PrototypeReorderDatesModal,
  type ReorderBlock,
  dateShiftsFor,
  reorderBlockFor,
} from './PrototypeReorderDatesModal';
import {
  reflowPhaseDates,
  acceptsProposals,
  addablePhaseTypes,
  createPhase,
  isPhaseComplete,
  newPhaseName,
  phaseTypeBlocker,
  phaseTypeLabel,
  nextPhaseIndex,
  phaseCopy,
  type PrototypePhase,
  type PrototypeProcess,
} from './store';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * The phase rail, in two modes.
 *
 * **Editing** is one list of identical cards: name, a line about the phase, and
 * one control on the right. A phase that is ready shows a chevron into it; one
 * that isn't shows what it wants. Order is a decision too, so the list sorts,
 * and a phase can be added at the end. A draft is always in this mode — there is
 * nothing to rest from — and a live process is put into it by `Edit`.
 *
 * **Resting** is the live page as participants meet it: the schedule, with the
 * phases that have run, the one running now, and the ones to come. Only a phase
 * that couldn't run yet breaks that voice, because that is a fact the admin
 * needs and nobody else's business.
 */
export function PrototypePhaseRail({
  process,
  isEditing,
  locale,
  onOpenPhase,
  onOpenCurrent,
  onChange,
}: {
  process: PrototypeProcess;
  isEditing: boolean;
  locale: string;
  onOpenPhase: (phaseId: string) => void;
  /** Where the phase people are looking at right now is shown. */
  onOpenCurrent?: () => void;
  onChange: (patch: (process: PrototypeProcess) => PrototypeProcess) => void;
}) {
  const addable = addablePhaseTypes(process);
  const isEmpty = process.phases.length === 0;
  /* A reorder that moves dated phases is held here between the drop and the
     answer: the list already shows the new order, but every card still shows the
     dates it had, and nothing is written until `Update dates`. `before` is what
     `Keep current order` puts back. */
  const [pendingReorder, setPendingReorder] = useState<{
    before: PrototypePhase[];
    reflowed: PrototypePhase[];
    moved: string;
    shifts: DateShift[];
    unchanged: number;
  } | null>(null);
  /* Which date labels just changed, so the update can be seen landing on the
     cards rather than only in the dialog that asked about it. */
  const [pulsing, setPulsing] = useState<string[]>([]);
  /* Why a reorder was refused, when the running phase would have been disturbed
     by it. Null the rest of the time. */
  const [blocked, setBlocked] = useState<ReorderBlock | null>(null);
  const pressed = useRef<string | null>(null);
  const pulseTimer = useRef<number | null>(null);
  /* What the dialog says, kept past the answer so it still reads correctly
     through the close. */
  const lastPrompt = useRef<typeof pendingReorder>(null);

  if (pendingReorder) {
    lastPrompt.current = pendingReorder;
  }

  const shown = pendingReorder ?? lastPrompt.current;

  useEffect(
    () => () => {
      if (pulseTimer.current !== null) {
        window.clearTimeout(pulseTimer.current);
      }
    },
    [],
  );

  const reorder = (next: PrototypePhase[]) => {
    const sameOrder = next.every((phase, index) => {
      return process.phases[index]?.id === phase.id;
    });

    // Dropped back where it started: there is nothing to ask about.
    if (sameOrder) {
      return;
    }

    const reflowed = reflowPhaseDates(next);
    const moved =
      next.find((phase) => phase.id === pressed.current) ??
      /* Falling back to the phase that travelled furthest. Only reachable via
         the keyboard, where there is no pointer to have pressed anything. */
      next.reduce((furthest, phase) => {
        const travelled = (candidate: PrototypePhase) =>
          Math.abs(
            next.findIndex((item) => item.id === candidate.id) -
              process.phases.findIndex((item) => item.id === candidate.id),
          );

        return travelled(phase) > travelled(furthest) ? phase : furthest;
      }, next[0]);
    const movedName = moved?.name || 'Untitled phase';

    /* The running phase is not a plan any more, so it is checked before
       anything is previewed or asked about: a refused reorder never reaches the
       list at all, and the rail stays as it was. */
    const block = reorderBlockFor({
      before: process.phases,
      after: next,
      currentIndex,
      movedId: moved?.id,
      movedName,
    });

    if (block) {
      setBlocked(block);

      return;
    }

    const { shifts, unchanged } = dateShiftsFor(process.phases, reflowed);

    // Undated phases, or an order that happens to leave every window alone.
    if (shifts.length === 0) {
      onChange((current) => ({ ...current, phases: next }));

      return;
    }

    setPendingReorder({
      before: process.phases,
      reflowed,
      moved: movedName,
      shifts,
      unchanged,
    });

    // The order previews immediately; only the dates wait for the answer.
    onChange((current) => ({ ...current, phases: next }));
  };

  const confirmReorder = () => {
    const pending = pendingReorder;

    if (!pending) {
      return;
    }

    onChange((current) => ({ ...current, phases: pending.reflowed }));
    setPendingReorder(null);
    setPulsing(pending.shifts.map((shift) => shift.id));

    if (pulseTimer.current !== null) {
      window.clearTimeout(pulseTimer.current);
    }

    pulseTimer.current = window.setTimeout(() => setPulsing([]), 900);
  };

  const cancelReorder = () => {
    const pending = pendingReorder;

    if (!pending) {
      return;
    }

    onChange((current) => ({ ...current, phases: pending.before }));
    setPendingReorder(null);
  };
  const currentIndex = process.currentPhaseIndex;
  const currentId = process.phases[currentIndex]?.id;
  /* Which unfinished phase gets the emphasis. Resting, the phase running now is
     drawn as itself rather than as a setup card, so it can't be the one — the
     emphasis moves to the first one that will actually appear as a card. */
  const leadIndex = isEditing
    ? nextPhaseIndex(process)
    : process.phases.findIndex(
        (phase, index) => !isPhaseComplete(phase) && index !== currentIndex,
      );
  /* Accent means "this is the live one" on a process that has one. A draft has
     no live phase, so there the fill is free to mean "this is the one holding
     you up" instead. */
  const tintsTheLead = currentIndex < 0;

  if (!isEditing) {
    return (
      <ol className="flex flex-col gap-4">
        {process.phases.map((phase, index) => (
          <RestingPhaseCell
            key={phase.id}
            phase={phase}
            locale={locale}
            index={index}
            leads={index === leadIndex}
            tinted={tintsTheLead && index === leadIndex}
            process={process}
            onOpen={() => onOpenPhase(phase.id)}
            onOpenCurrent={onOpenCurrent}
          />
        ))}
      </ol>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Sortable
        items={process.phases}
        onChange={reorder}
        dragTrigger="handle"
        aria-label="Phases, in order"
        getItemLabel={(phase) => phase.name || 'Untitled phase'}
        /* The handles hang 24px off the start edge, which is free space beside
           the sidebar at full width. Stacked, the rail is against the page's own
           padding and they would hang off the screen — so there the list reserves
           the gutter itself and the cards give up the width instead. */
        className="flex flex-col gap-4 ps-6 md:ps-0"
      >
        {(phase, { dragHandleProps }) => (
          <EditingPhaseCell
            phase={phase}
            process={process}
            locale={locale}
            leads={process.phases.indexOf(phase) === leadIndex}
            tinted={tintsTheLead && process.phases.indexOf(phase) === leadIndex}
            /* A live process keeps saying which phase is open while you edit
               around it — the schedule doesn't pause because you are editing. */
            isNowOpen={phase.id === currentId && acceptsProposals(phase)}
            isCurrent={phase.id === currentId}
            /* Which row the drag started on, which is the phase the dialog is
               about. Read on the way down so it is already known by the time the
               drop reports the new order — the list itself only says what the
               order became, not what was moved to get there. */
            onPress={() => {
              pressed.current = phase.id;
            }}
            pulsing={pulsing.includes(phase.id)}
            dragHandleProps={dragHandleProps}
            onOpen={() => onOpenPhase(phase.id)}
          />
        )}
      </Sortable>

      {/* Mounted whether or not it is open, and closed by `isOpen`. Unmounting
          it the moment it was answered took the dialog out of the tree before it
          could close itself, and its overlay was left behind over the whole page
          — every click after a reorder went into a backdrop nobody could see.
          The content is held while it closes so the panel does not empty out on
          its way off the screen. */}
      <PrototypeReorderBlockedModal
        block={blocked}
        onDismiss={() => setBlocked(null)}
      />

      <PrototypeReorderDatesModal
        isOpen={pendingReorder !== null}
        moved={shown?.moved ?? ''}
        shifts={shown?.shifts ?? []}
        unchanged={shown?.unchanged ?? 0}
        locale={locale}
        onConfirm={confirmReorder}
        onCancel={cancelReorder}
      />

      {/* Adding one means picking what kind, so the button is the menu rather
          than a step towards it. */}
      {/* Stays mounted through the sequence and collapses its own height, so the
          rail closes up rather than losing a row in one frame. */}
      {addable.length > 0 ? (
        <div
          data-launch="add-phase"
          style={{ '--launch-space': '2.75rem' } as React.CSSProperties}
        >
          <DropdownMenu>
            {/* Filled and full width while the rail is empty: on a blank process
              this is the only thing to do. Once there are phases it is a way to
              add another rather than the thing to do — a link under the list,
              aligned to the cards' own start edge. */}
            <DropdownMenuTrigger
              render={
                isEmpty ? (
                  <Button variant="default" className="w-full" />
                ) : (
                  <Button variant="link" className="w-fit" />
                )
              }
            >
              <LuPlus className="size-4" aria-hidden />
              Add a phase
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              {addable.map((phaseType) => {
                const blocker = phaseTypeBlocker(process, phaseType);

                return (
                  <DropdownMenuItem
                    key={phaseType}
                    disabled={blocker !== null}
                    className={blocker ? 'items-start' : undefined}
                    onClick={() =>
                      onChange((current) => ({
                        ...current,
                        phases: [
                          ...current.phases,
                          createPhase(
                            phaseType,
                            newPhaseName(phaseType),
                            current.audience,
                          ),
                        ],
                      }))
                    }
                  >
                    <span className="flex flex-col">
                      {phaseTypeLabel(phaseType)}
                      {/* Not muted: the whole row is already at half opacity, and
                        muting on top of that puts the one thing explaining the
                        dead end below reading contrast. */}
                      {blocker ? (
                        <span className="text-sm">{blocker}</span>
                      ) : null}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  );
}

/**
 * One row while editing. Every phase is the same card — what changes is the
 * control on the right and, for the one still holding the process up, the fill.
 */
function EditingPhaseCell({
  phase,
  process,
  locale,
  leads,
  tinted,
  isNowOpen,
  isCurrent,
  pulsing,
  onPress,
  dragHandleProps,
  onOpen,
}: {
  phase: PrototypePhase;
  process: PrototypeProcess;
  locale: string;
  /** The first phase that isn't ready — the one the rail points at. */
  leads: boolean;
  /** Draft only: the accent is spoken for once a process is running. */
  tinted: boolean;
  isNowOpen: boolean;
  /** The phase running right now, on a process that has one. */
  isCurrent: boolean;
  /** Its dates just changed, and should be seen to have. */
  pulsing?: boolean;
  onPress?: () => void;
  dragHandleProps: Record<string, unknown>;
  onOpen: () => void;
}) {
  /* A running phase is presented as running even if it was never finished being
     set up. The resting rail already does this — it draws the current phase as
     the phase people are in — so without the same rule here, opening the rail
     to edit it grew a `Setup` button on a phase that had none a moment ago, and
     the same phase read as two different things. Nothing is lost: the row is
     still the way in to set it up. */
  const isReady = isPhaseComplete(phase) || isCurrent;
  const name = phase.name || 'Untitled phase';

  const card = cn(
    /* `whitespace-normal` because the ready row is a `Button`, and a button does
       not wrap: a long phase name ran straight out of the card and across the
       column beside it, and the cell stayed one line tall while the live card it
       becomes wrapped to several. */
    /* Geometrically identical to the live card, deliberately: same `gap-4` and
       same `size-8` trailing box, so the name gets the same width and wraps the
       same way, and a ring rather than a border, so the row is not the 2px
       taller that a real border makes it. The launch sequence animates one card
       into the other, and it can only do that if the two agree on everything
       except what is actually changing. */
    'flex w-full items-center gap-4 rounded-lg p-4 text-start whitespace-normal ring-1 ring-border transition-colors ring-inset',
    // The one phase holding the process up is the one the rail fills.
    tinted && !isReady && 'bg-accent',
  );

  const body = (
    <span className="flex min-w-0 flex-1 flex-col">
      {/* Outlined here where the resting rail fills it: editing, this is a fact
          about the phase among other facts, not the page's headline. */}
      {/* The chip's row of space opens before the chip does, so the card grows
          once rather than snapping taller under it. */}
      {isNowOpen ? (
        <span
          data-launch="chip-space"
          className="mb-2 flex"
          style={{ '--launch-space': '1.25rem' } as React.CSSProperties}
        >
          <Badge data-launch="chip" variant="outline" className="w-fit">
            Now open!
          </Badge>
        </span>
      ) : null}
      <span className="font-serif text-title font-normal">
        <bdi>{name}</bdi>
      </span>
      {/* Dates once it has them, and what the phase is for until it does — a row
          that says nothing is worse than one that says what it would do. */}
      <span
        data-pulse={pulsing ? 'dates' : undefined}
        /* Negative margin against the padding, so the pulse has room around the
           text without the label taking any more space than it did. */
        className="-mx-1 min-h-5 rounded-sm px-1 text-sm font-normal text-muted-foreground"
      >
        {isReady
          ? formatPhaseWindow(phase, locale)
          : phaseCopy(process, phase.phaseType).blurb}
      </span>
    </span>
  );

  return (
    <div
      className="group/phase relative"
      /* Capture, so pressing the handle registers before the drag begins and
         without taking the press away from anything inside the row. */
      onPointerDownCapture={onPress}
    >
      {isReady ? (
        /* The whole row is the control, chevron and all — a ready phase has one
           thing you can do to it, so making the card the button beats a small
           target at the end of a row you are already pointing at. */
        <Button
          variant="bare"
          aria-label={`Set up ${name}`}
          className={cn(card, 'h-auto hover:bg-muted')}
          onClick={onOpen}
        >
          {body}
          {/* The live card's own trailing control, matched: same box, same glyph,
              same inherited colour. It was a muted chevron, which meant the row
              changed its mind about what sat there at the very moment the card
              was meant to be holding still. */}
          <span className="flex size-8 shrink-0 items-center justify-center">
            <LuArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
          </span>
        </Button>
      ) : (
        /* Not a whole-row button: the row carries its own control, and a button
           inside a button is neither valid nor operable. */
        <div className={card}>
          {body}
          <Button
            variant={leads ? 'default' : 'outline'}
            size="sm"
            aria-label={`Set up ${name}`}
            onClick={onOpen}
          >
            Setup
          </Button>
        </div>
      )}

      {/* Outside the card and out of sight until the row is reached for:
          re-ordering is the rarer thing to want, and a grip on every row read as
          five more controls. */}
      <DragHandle
        {...dragHandleProps}
        aria-label={`Reorder ${name}`}
        className="absolute -start-6 top-1/2 z-10 -translate-y-1/2 p-0 opacity-0 transition-opacity group-hover/phase:opacity-100 focus-visible:opacity-100"
      />
    </div>
  );
}

/**
 * One row of the live rail at rest. The schedule speaks for itself — except for
 * a phase that couldn't run if it were reached, which is the admin's problem and
 * so wears the same card it wears while editing.
 */
function RestingPhaseCell({
  phase,
  process,
  locale,
  index,
  leads,
  tinted,
  onOpen,
  onOpenCurrent,
}: {
  phase: PrototypePhase;
  process: PrototypeProcess;
  locale: string;
  index: number;
  leads: boolean;
  tinted: boolean;
  onOpen: () => void;
  onOpenCurrent?: () => void;
}) {
  const isCurrent = index === process.currentPhaseIndex;
  const links = isCurrent && Boolean(onOpenCurrent);

  // Not ready, and not the phase people are looking at: the only thing worth
  // saying is that it still needs setting up.
  if (!isPhaseComplete(phase) && !isCurrent) {
    return (
      /* Resting, this card is plain. In the draft it was the filled one — the
         rail's fill means "this is what's holding you up" until there is a live
         phase to spend it on — so through the sequence it fades its old fill out
         while the running phase fades one in. Inert unless the page is
         launching, so the resting rail is unaffected. */
      <li
        data-launch={
          index === nextPhaseIndex(process) ? 'phase-tint-out' : undefined
        }
      >
        <SetupCard
          phase={phase}
          process={process}
          leads={leads}
          tinted={tinted}
          onOpen={onOpen}
        />
      </li>
    );
  }

  const card = (
    <PhaseCard
      // Wrapped below when it links, and the wrapper is then the list item.
      as={links ? 'div' : 'li'}
      name={phase.name || 'Untitled phase'}
      startDate={phase.startDate}
      endDate={phase.endDate}
      locale={locale}
      state={
        index < process.currentPhaseIndex
          ? 'completed'
          : isCurrent
            ? 'current'
            : 'upcoming'
      }
      // "Now open!" reports that submissions are being taken, which is the
      // phase's own rule and not a property of its type.
      isNowOpen={isCurrent && acceptsProposals(phase)}
      /* The running phase's card is already a link in the design system — it
         just had nowhere to go. The only place it could sensibly lead is the
         page people are looking at right now. */
      href={links ? '#' : undefined}
      nowOpenLabel="Now open!"
    />
  );

  if (!links) {
    return card;
  }

  /* Caught on the way up rather than passed in: the card owns its own anchor,
     and this page routes by hash rather than by href. Keyboard activation lands
     here too, since Enter on a link fires a click. */
  return (
    <li
      onClick={(event) => {
        event.preventDefault();
        onOpenCurrent?.();
      }}
    >
      {card}
    </li>
  );
}

/** The unfinished row, identical in both modes. */
function SetupCard({
  phase,
  process,
  leads,
  tinted,
  onOpen,
}: {
  phase: PrototypePhase;
  process: PrototypeProcess;
  leads: boolean;
  tinted: boolean;
  onOpen: () => void;
}) {
  const name = phase.name || 'Untitled phase';

  return (
    <div
      className={cn(
        // The same card as the rest of the rail — see `EditingPhaseCell`.
        'flex w-full items-center gap-4 rounded-lg p-4 ring-1 ring-border ring-inset',
        tinted && 'bg-accent',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="font-serif text-title">
          <bdi>{name}</bdi>
        </p>
        <p className="min-h-5 text-sm text-muted-foreground">
          {phaseCopy(process, phase.phaseType).blurb}
        </p>
      </div>
      <Button
        variant={leads ? 'default' : 'outline'}
        size="sm"
        aria-label={`Set up ${name}`}
        onClick={onOpen}
      >
        Setup
      </Button>
    </div>
  );
}

/**
 * "Jun 15 - Jul 30" — the same shape `PhaseCard` uses. It has to be: the draft
 * cell and the live card show the same phase, and a rail that spelled the month
 * out reformatted its own dates the moment the process went live.
 */
function formatPhaseWindow(phase: PrototypePhase, locale: string): string {
  const day = (value: string) =>
    new Date(value).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });

  if (!phase.startDate || !phase.endDate) {
    return '';
  }

  // A results phase happens on a day rather than running between two.
  return phase.startDate === phase.endDate
    ? day(phase.startDate)
    : `${day(phase.startDate)} - ${day(phase.endDate)}`;
}
