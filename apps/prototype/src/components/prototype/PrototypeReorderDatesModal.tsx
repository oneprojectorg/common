'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@op/sense/AlertDialog';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { LuArrowRight } from 'react-icons/lu';

import { formatDateSpanWords } from './formatDate';
import { type PrototypePhase, isPhaseDated } from './store';

/** One phase whose window the reorder moves, with both windows to compare. */
export interface DateShift {
  id: string;
  name: string;
  from: { startDate: string; endDate: string };
  to: { startDate: string; endDate: string };
}

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * The step between dropping a phase in a new position and the schedule actually
 * moving. Reordering dated phases changes when other phases run, which is a
 * consequence nobody can see from the drag itself — so the drop previews the
 * order and this says what it would cost before anything is written.
 *
 * A plain dialog rather than an alert: nothing here is destructive or wrong, and
 * an alert's weight would make a routine reorder feel like a mistake. The two
 * buttons are both ordinary answers to an ordinary question.
 */
export function PrototypeReorderDatesModal({
  isOpen,
  moved,
  shifts,
  unchanged,
  locale,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  /** The phase that was dragged — the one the title is about. */
  moved: string;
  shifts: DateShift[];
  /** How many phases keep the dates they have. */
  unchanged: number;
  locale: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open={isOpen}
      /* Escape and the backdrop are the secondary button: leaving without
         answering is the same as declining, and the order snaps back. */
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-[30rem]">
        <DialogHeader>
          <DialogTitle>Moving {moved} shifts phase dates</DialogTitle>
          <DialogDescription>
            Phases keep their length. Start dates update to match the new order.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 py-5">
          {shifts.map((shift) => (
            <div key={shift.id} className="flex flex-col gap-1">
              {/* Its own line, because phase names are written by admins and
                  run long — wrapping one is expected, wrapping the dates it
                  belongs to is not. */}
              <span className="text-sm font-strong">
                <bdi>{shift.name}</bdi>
              </span>
              <span className="flex items-center gap-2 text-sm">
                <span className="whitespace-nowrap text-muted-foreground">
                  {formatDateSpanWords(
                    shift.from.startDate,
                    shift.from.endDate,
                    locale,
                  )}
                </span>
                <LuArrowRight
                  className="size-3.5 shrink-0 text-muted-foreground rtl:-scale-x-100"
                  aria-hidden
                />
                <span className="font-strong whitespace-nowrap">
                  {formatDateSpanWords(
                    shift.to.startDate,
                    shift.to.endDate,
                    locale,
                  )}
                </span>
              </span>
            </div>
          ))}

          {/* Said once for all of them rather than a row each: the phases that
              are staying put are reassurance, not detail to read. */}
          {unchanged > 0 ? (
            <p className="text-sm text-muted-foreground">
              {unchanged === 1
                ? '1 other phase keeps its dates.'
                : `${unchanged} other phases keep their dates.`}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Keep current order
          </Button>
          <Button onClick={onConfirm}>Update dates</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Which phases the new order moves, and how many it leaves alone. Compares the
 * dates the phases have now against the ones the new order would give them, and
 * reports only the differences — a phase that lands where its window already
 * was has nothing to say.
 */
export function dateShiftsFor(
  before: PrototypePhase[],
  reflowed: PrototypePhase[],
): { shifts: DateShift[]; unchanged: number } {
  const current = new Map(before.map((phase) => [phase.id, phase]));
  const shifts: DateShift[] = [];
  let unchanged = 0;

  // In the new order: the list is read as the schedule it is about to become.
  for (const phase of reflowed) {
    const was = current.get(phase.id);

    if (!was || !isPhaseDated(phase) || !isPhaseDated(was)) {
      continue;
    }

    if (was.startDate === phase.startDate && was.endDate === phase.endDate) {
      unchanged += 1;
      continue;
    }

    shifts.push({
      id: phase.id,
      name: phase.name || 'Untitled phase',
      from: { startDate: was.startDate, endDate: was.endDate },
      to: { startDate: phase.startDate, endDate: phase.endDate },
    });
  }

  return { shifts, unchanged };
}

/** Why a reorder was refused, which is also which sentence explains it. */
export type ReorderBlock =
  | { kind: 'moved-current'; current: string }
  | { kind: 'moved-past'; moved: string }
  | { kind: 'crosses-current'; moved: string; current: string };

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * The reorder that cannot happen. Everything up to and including the running
 * phase has stopped being a plan: those phases either already happened or are
 * happening now. Only what is still ahead can be rearranged.
 *
 * An alert rather than the confirmation dialog, because there is no choice to
 * offer: this is the answer, not a question.
 */
export function PrototypeReorderBlockedModal({
  block,
  onDismiss,
}: {
  block: ReorderBlock | null;
  onDismiss: () => void;
}) {
  return (
    <AlertDialog
      open={block !== null}
      onOpenChange={(open) => {
        if (!open) {
          onDismiss();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{blockedTitle(block)}</AlertDialogTitle>
          <AlertDialogDescription>{blockedBody(block)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onDismiss}>Got it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function blockedTitle(block: ReorderBlock | null): string {
  switch (block?.kind) {
    case 'moved-current':
      return `${block.current} is running now`;
    case 'moved-past':
      return `${block.moved} has already run`;
    default:
      return `${block?.moved ?? 'This phase'} can't move before ${
        block?.current ?? 'the phase running now'
      }`;
  }
}

function blockedBody(block: ReorderBlock | null): string {
  switch (block?.kind) {
    case 'moved-current':
      return 'A phase people are taking part in cannot be moved. Its dates are what every phase after it is scheduled from.';
    case 'moved-past':
      return 'A phase that has already run cannot be moved. Reordering it would rewrite when it happened.';
    default:
      return `${
        block?.current ?? 'The phase running now'
      } is running now. Only the phases still ahead of it can be reordered.`;
  }
}

/**
 * Whether a proposed order disturbs anything that has stopped being a plan.
 * Every phase up to and including the running one is settled: those either
 * already happened or are happening now, and their dates are what the rest of
 * the schedule is built from. So the rule is one comparison — that run of
 * phases has to come back in the same order — and everything after it is free.
 *
 * A process with no running phase, which is any draft, has nothing settled and
 * so nothing is ever refused there.
 */
export function reorderBlockFor({
  before,
  after,
  currentIndex,
  movedId,
  movedName,
}: {
  before: PrototypePhase[];
  after: PrototypePhase[];
  currentIndex: number;
  movedId?: string;
  movedName: string;
}): ReorderBlock | null {
  const current = before[currentIndex];

  if (!current) {
    return null;
  }

  const settled = before.slice(0, currentIndex + 1);

  if (settled.every((phase, index) => after[index]?.id === phase.id)) {
    return null;
  }

  const movedFrom = before.findIndex((phase) => phase.id === movedId);

  // A settled phase was dragged, rather than something being dragged past it.
  if (movedFrom >= 0 && movedFrom <= currentIndex) {
    return movedFrom === currentIndex
      ? { kind: 'moved-current', current: current.name || 'Untitled phase' }
      : { kind: 'moved-past', moved: movedName };
  }

  return {
    kind: 'crosses-current',
    moved: movedName,
    current: current.name || 'Untitled phase',
  };
}
