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
import { cn } from '@op/sense/lib/utils';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { LuPencil, LuX } from 'react-icons/lu';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * A piece of the live page that can be edited where it sits. There is no edit
 * mode: the page is the page, and the affordance for changing something appears
 * on the thing itself when you reach for it.
 *
 * Read state is the participant's view, untouched — which is the point. Hover or
 * keyboard focus reveals `Edit text`; taking it swaps in the editor in the same
 * place. Nothing moves, because the editor occupies the same box.
 *
 * Edits run against a working copy and are only kept when confirmed: `Update`
 * commits, the cross discards, and Escape discards. That way the live page never
 * shows a half-typed paragraph to the people reading it.
 *
 * Clicking away closes the editor — silently when nothing was typed, and after
 * asking when something was. Leaving an editor open behind you is how you lose
 * work you thought was saved, and quietly keeping *or* dropping the edit is the
 * kind of guess a page should not make on your behalf.
 *
 * `alwaysEditing` drops all of that for a draft, where there is no reading view
 * to protect: the editor is simply always up, clicking into it is how you start,
 * and every keystroke is kept.
 *
 * The controls are real buttons and the group responds to `focus-within`, so the
 * whole thing is reachable by keyboard rather than being a mouse-only trick.
 */
export function HoverEdit<T>({
  label,
  editSlot,
  value,
  onCommit,
  read,
  edit,
  className,
  heading,
  alwaysEditing = false,
}: {
  /** Names the controls, e.g. "the about section". */
  label: string;
  /** What is committed. Edits run against a copy until confirmed. */
  value: T;
  onCommit: (next: T) => void;
  read: ReactNode;
  /** The editor, handed the working copy and a way to change it. */
  edit: (draft: T, setDraft: (next: T) => void) => ReactNode;
  /**
   * A heading for the thing being edited. Given one, the affordance stops being
   * a button that floats over the text and becomes a row above it — the heading
   * on one side, `Edit`/`Done` on the other, the way the rail beside it works.
   * The row counts as part of the edit, so pressing `Done` is not "clicking
   * away".
   */
  heading?: ReactNode;
  /** Names this `Edit` for the launch sequence, which rises them in last. */
  editSlot?: string;
  className?: string;
  /**
   * Skip the read state and the confirm step: the editor is up from the start
   * and writes straight through. For a draft, where nothing is published and so
   * nothing needs protecting from a half-finished sentence.
   */
  alwaysEditing?: boolean;
}) {
  const [draft, setDraft] = useState<T | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const isOpen = draft !== null;
  const isEditing = alwaysEditing || isOpen;
  const isDirty = isOpen && JSON.stringify(draft) !== JSON.stringify(value);
  const box = useRef<HTMLDivElement>(null);
  /** The heading row, when there is one — also inside the edit. */
  const outer = useRef<HTMLDivElement>(null);

  const commit = () => {
    if (draft !== null) {
      onCommit(draft);
    }

    setDraft(null);
  };
  const discard = () => setDraft(null);
  /** A draft writes through; a live edit collects into the working copy. */
  const setValue = (next: T) => {
    if (alwaysEditing) {
      onCommit(next);

      return;
    }

    // Only while the box is open. A rich-text editor can report a change after
    // the fact, and a late one arriving after a discard would otherwise
    // resurrect the edit that was just thrown away.
    setDraft((current) => (current === null ? null : next));
  };

  // Escape discards, which is what Escape means everywhere else. Focus leaving
  // the box does *not* commit or discard: an editor here can hold a toolbar and
  // several inputs, and clicking one of those must not end the edit.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        discard();
      }
    };
    const node = box.current;

    node?.addEventListener('keydown', onKeyDown);

    return () => node?.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  /*
   * Clicking away ends the edit. Watched on `pointerdown` rather than on focus
   * leaving the box, because the editor can hold a toolbar and several inputs
   * of its own and taking one of those is not leaving. Anything inside the box
   * — the controls included — is inside the edit.
   */
  useEffect(() => {
    if (!isOpen || isConfirming) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const node = box.current;

      if (
        !node ||
        !(event.target instanceof Node) ||
        node.contains(event.target) ||
        outer.current?.contains(event.target)
      ) {
        return;
      }

      if (!isDirty) {
        discard();

        return;
      }

      // With something typed, this press is a question rather than a command:
      // don't let it take the caret while the answer is still outstanding.
      event.preventDefault();
      setIsConfirming(true);
    };

    document.addEventListener('pointerdown', onPointerDown, true);

    return () =>
      document.removeEventListener('pointerdown', onPointerDown, true);
  }, [isOpen, isConfirming, isDirty]);

  const body = (
    <div
      ref={box}
      className={cn(
        'group/hover-edit relative rounded-lg transition-colors',
        alwaysEditing
          ? // A draft's body is always a field, but it should not look like one
            // until you are in it: the outline follows the caret, so the page
            // reads as a page until the moment you click into the text. The
            // tint is held back there, because a fill behind the words changes
            // how they read while you are writing them. It has to be
            // `not-focus-within:hover` rather than a `focus-within` override:
            // Tailwind emits `focus-within` ahead of `hover`, so an override
            // would lose to the tint whenever the pointer was still on the box.
            'focus-within:ring-1 focus-within:ring-input not-focus-within:hover:bg-muted/40'
          : isOpen
            ? // An outline and nothing else, for the same reason. `input`, not
              // `border`: this is a field you are typing in, and it should
              // read like the other fields in the product rather than like a
              // divider drawn around a paragraph.
              'ring-1 ring-input'
            : // A tint on approach, no outline: at rest this is a paragraph of
              // the page, and a box drawn around it says otherwise.
              'focus-within:bg-muted/40 hover:bg-muted/40',
        className,
      )}
    >
      {/* Zero-height and sticky, ahead of the content: the row hangs in the
          top corner where `Edit text` was, and stays in view while a long body
          scrolls past under it — `Save` is no use at the bottom of a page you
          have scrolled away from. `top-16` clears the page's own sticky bar. */}
      {alwaysEditing || heading ? null : (
        <div className="sticky top-16 z-20 flex h-0 justify-end">
          <div
            className={cn(
              // A soft lift on each control: sticky means they end up over the
              // body text on a long page, and without a shadow a line of prose
              // running behind a button reads as a rendering fault.
              'flex gap-2 [&>*]:shadow-sm',
              !isOpen &&
                'opacity-0 transition-opacity group-focus-within/hover-edit:opacity-100 group-hover/hover-edit:opacity-100',
            )}
          >
            {isOpen ? (
              <>
                {/* Discard first, confirm last: the affirmative action sits
                    where the eye lands at the end of the row, as it does in a
                    dialog. Outline rather than destructive — dropping an unsaved
                    edit is a way out, not damage. */}
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={`Discard changes to ${label}`}
                  onClick={discard}
                >
                  <LuX className="size-4" aria-hidden />
                </Button>
                <Button size="sm" onClick={commit}>
                  Update
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                aria-label={`Edit ${label}`}
                onClick={() => setDraft(value)}
              >
                <LuPencil className="size-3.5" aria-hidden />
                Edit text
              </Button>
            )}
          </div>
        </div>
      )}

      {isEditing ? edit(alwaysEditing ? value : (draft as T), setValue) : read}

      {/* Dismissing it — Escape, or a press on the backdrop — puts you back in
          the editor with the edit intact, which is the only answer that loses
          nothing. */}
      <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Keep your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have edited {label} without saving. Keeping the changes puts
              them on the page participants read.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setIsConfirming(false);
                discard();
              }}
            >
              Discard
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                setIsConfirming(false);
                commit();
              }}
            >
              Save changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  if (!heading) {
    return body;
  }

  return (
    <div ref={outer} className="flex flex-col gap-3">
      {/* The heading and the way in, on one line — the rail's own row, so the
          two columns of this page offer the same thing in the same place. A
          draft has no read state to leave, so it has no button either. */}
      <div className="flex items-start justify-between gap-3">
        {heading}
        {alwaysEditing ? null : (
          <Button
            data-launch={editSlot}
            variant="link"
            size="inline"
            // The label step, so its line box matches the heading's.
            className="shrink-0 text-label"
            aria-label={isOpen ? `Finish editing ${label}` : `Edit ${label}`}
            onClick={() => (isOpen ? commit() : setDraft(value))}
          >
            <LuPencil className="size-3.5" aria-hidden />
            {isOpen ? 'Done' : 'Edit'}
          </Button>
        )}
      </div>
      {body}
    </div>
  );
}

/**
 * The same affordance for something whose editor is elsewhere — a phase, which
 * has a page of its own. Reveals a row of buttons rather than swapping in a
 * field, and the row is the caller's, so a phase can offer `View` or `Advance`
 * alongside `Edit` without any of them changing size or place.
 *
 * The hover state is a muted fill and nothing else: no ring, because a phase
 * cell is already a card and a second outline around it reads as a defect.
 */
export function HoverOpen({
  children,
  actions,
  footer,
  onActivate,
  activateLabel,
  className,
  as: Element = 'div',
}: {
  children: ReactNode;
  actions: ReactNode;
  /**
   * Makes the whole cell the way in, via a transparent overlay rather than by
   * wrapping the content in a button — a cell can hold a link and a CTA of its
   * own, and nesting those inside a button is both invalid and unusable.
   */
  onActivate?: () => void;
  activateLabel?: string;
  /**
   * Content below the cell that is always shown. The action row is positioned
   * against the cell rather than the whole wrapper, so it can't land on top of
   * whatever sits here.
   */
  footer?: ReactNode;
  className?: string;
  /**
   * `li` when the wrapper sits directly inside a list: the timeline is an `<ol>`
   * and a `<div>` between it and its rows would drop the list semantics
   * altogether.
   */
  as?: 'div' | 'li';
}) {
  return (
    <Element
      className={cn(
        'group/hover-open relative rounded-lg transition-colors focus-within:bg-muted hover:bg-muted',
        className,
      )}
    >
      <div className="relative">
        {children}

        {/* Against the end edge, centred on the row: the actions belong to the
            cell, and floating them in the middle read as a layer over the name
            rather than a control beside it. `end-4` is the card's own `p-4`, so
            a button lines up with the text above and below it rather than
            sitting closer to the edge than anything else in the cell.
            `pointer-events-none` on the overlay keeps the cell hoverable
            through the gaps between buttons. */}
        <div className="pointer-events-none absolute inset-y-0 end-4 z-10 flex items-center gap-1 opacity-0 transition-opacity *:pointer-events-auto group-focus-within/hover-open:opacity-100 group-hover/hover-open:opacity-100">
          {actions}
        </div>
      </div>

      {footer}

      {/* Last, and over the whole cell: "the card is clickable" has to mean the
          card, not the part of it the content happens to fill. Two positioned
          siblings at the same level paint in DOM order, so this has to come
          after the content it covers — and anything that must stay clickable
          through it carries its own `z-10`. */}
      {onActivate ? (
        <button
          type="button"
          aria-label={activateLabel}
          className="absolute inset-0 z-0 cursor-pointer rounded-[inherit] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={onActivate}
        />
      ) : null}
    </Element>
  );
}
